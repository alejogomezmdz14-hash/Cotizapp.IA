import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDraftQuotationMutationAllowed,
  assertSingleQuotationRollbackMutation,
  buildQuotationNumber,
  deleteQuotationAttachmentWithCleanup,
  formatCleanupFailureMessage,
  getDraftQuotationEditorHref,
  hydrateQuotationAttachments,
  loadDraftQuotationHydrationContext,
  parseQuotationFormData,
  persistDraftQuotation,
  rollbackUploadedQuotationAttachments,
} from "../lib/quotations";

test("parseQuotationFormData accepts an existing client selection and normalizes items", () => {
  const formData = new FormData();
  formData.set("client_mode", "existing");
  formData.set("client_id", "client-1");
  formData.set("tax_rate", " 21 ");
  formData.set("notes", "  Entrega en 48 horas  ");
  formData.set("valid_until", "2026-06-01");
  formData.set(
    "items_payload",
    JSON.stringify([
      {
        catalogItemId: "cat-1",
        name: "  Cemento portland  ",
        description: "  Bolsa de 50 kg  ",
        quantity: "2",
        unit: " bolsa ",
        unitPrice: "1299,50",
      },
    ]),
  );

  assert.deepEqual(parseQuotationFormData(formData), {
    clientId: "client-1",
    inlineClient: null,
    taxRate: 21,
    notes: "Entrega en 48 horas",
    validUntil: "2026-06-01",
    items: [
      {
        catalogItemId: "cat-1",
        name: "Cemento portland",
        description: "Bolsa de 50 kg",
        quantity: 2,
        unit: "bolsa",
        unitPrice: 1299.5,
      },
    ],
  });
});

test("parseQuotationFormData accepts inline client payload and trims optional fields", () => {
  const formData = new FormData();
  formData.set("client_mode", "inline");
  formData.set(
    "client_payload",
    JSON.stringify({
      name: "  Obra Norte  ",
      email: "   ",
      phone: " 2615551234 ",
      address: "  Rodriguez Pena 3341 ",
    }),
  );
  formData.set("tax_rate", "10.5");
  formData.set(
    "items_payload",
    JSON.stringify([
      {
        name: "  Mano de obra  ",
        description: "  Instalacion completa  ",
        quantity: "1",
        unit: " servicio ",
        unitPrice: "15000",
      },
    ]),
  );

  assert.deepEqual(parseQuotationFormData(formData), {
    clientId: null,
    inlineClient: {
      name: "Obra Norte",
      email: null,
      phone: "2615551234",
      address: "Rodriguez Pena 3341",
    },
    taxRate: 10.5,
    notes: null,
    validUntil: null,
    items: [
      {
        catalogItemId: null,
        name: "Mano de obra",
        description: "Instalacion completa",
        quantity: 1,
        unit: "servicio",
        unitPrice: 15000,
      },
    ],
  });
});

test("parseQuotationFormData rejects existing mode without a selected client", () => {
  const formData = new FormData();
  formData.set("client_mode", "existing");
  formData.set("items_payload", JSON.stringify([{ name: "Servicio", quantity: 1, unitPrice: 1 }]));

  assert.throws(
    () => parseQuotationFormData(formData),
    /Selecciona un cliente existente o crea uno nuevo dentro de la cotizacion\./,
  );
});

test("parseQuotationFormData rejects missing items", () => {
  const formData = new FormData();
  formData.set("client_mode", "inline");
  formData.set("client_payload", JSON.stringify({ name: "Cliente demo" }));
  formData.set("items_payload", JSON.stringify([]));

  assert.throws(
    () => parseQuotationFormData(formData),
    /Agrega al menos un item a la cotizacion antes de guardarla\./,
  );
});

test("parseQuotationFormData rejects malformed item values", () => {
  const formData = new FormData();
  formData.set("client_mode", "inline");
  formData.set("client_payload", JSON.stringify({ name: "Cliente demo" }));
  formData.set(
    "items_payload",
    JSON.stringify([
      {
        name: "  ",
        quantity: "0",
        unit: "unidad",
        unitPrice: "-10",
      },
    ]),
  );

  assert.throws(
    () => parseQuotationFormData(formData),
    /Cada item necesita un concepto, una cantidad valida y un precio valido\./,
  );
});

test("buildQuotationNumber uses a stable timestamp-based format", () => {
  assert.equal(
    buildQuotationNumber(new Date("2026-05-25T14:56:07.000Z"), "a1b2c3"),
    "COT-20260525-145607-A1B2C3",
  );
});

test("assertSingleQuotationRollbackMutation accepts exactly one cleaned row", () => {
  assert.doesNotThrow(() => {
    assertSingleQuotationRollbackMutation([{ id: "quotation-1" }], "quotation");
  });
});

test("assertSingleQuotationRollbackMutation rejects missing quotation cleanup rows", () => {
  assert.throws(
    () => assertSingleQuotationRollbackMutation([], "quotation"),
    /No se pudo revertir la cotizacion borrador\./,
  );
});

test("assertSingleQuotationRollbackMutation rejects missing client cleanup rows", () => {
  assert.throws(
    () => assertSingleQuotationRollbackMutation([], "client"),
    /No se pudo eliminar el cliente temporal creado para la cotizacion\./,
  );
});

test("assertDraftQuotationMutationAllowed rejects quotations that are not mutable drafts", async () => {
  await assert.rejects(
    () =>
      assertDraftQuotationMutationAllowed(
        {
          getDraftQuotation: async () => null,
        },
        "quotation-1",
      ),
    /La cotizacion no existe, no te pertenece o ya no se puede modificar\./,
  );
});

test("persistDraftQuotation removes the inline client when quotation creation fails", async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      persistDraftQuotation(
        {
          createInlineClient: async () => {
            calls.push("create-inline-client");
            return { id: "client-inline", name: "Obra Norte" };
          },
          getExistingClient: async () => {
            throw new Error("No deberia consultar un cliente existente.");
          },
          createQuotation: async () => {
            calls.push("create-quotation");
            throw new Error("No se pudo guardar la cotizacion borrador.");
          },
          createQuotationItems: async () => {
            calls.push("create-items");
          },
          deleteQuotation: async () => {
            calls.push("delete-quotation");
          },
          deleteClient: async (clientId) => {
            calls.push(`delete-client:${clientId}`);
          },
        },
        {
          values: {
            clientId: null,
            inlineClient: {
              name: "Obra Norte",
              email: null,
              phone: null,
              address: null,
            },
            notes: null,
            taxRate: 21,
            validUntil: null,
            items: [
              {
                catalogItemId: null,
                name: "Cemento",
                description: null,
                quantity: 1,
                unit: "bolsa",
                unitPrice: 1200,
              },
            ],
          },
          quotationNumber: "COT-20260525-145607-A1B2C3",
          subtotal: 1200,
          total: 1452,
        },
      ),
    /No se pudo guardar la cotizacion borrador\./,
  );

  assert.deepEqual(calls, [
    "create-inline-client",
    "create-quotation",
    "delete-client:client-inline",
  ]);
});

test("persistDraftQuotation removes quotation and inline client when item persistence fails", async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      persistDraftQuotation(
        {
          createInlineClient: async () => {
            calls.push("create-inline-client");
            return { id: "client-inline", name: "Obra Norte" };
          },
          getExistingClient: async () => {
            throw new Error("No deberia consultar un cliente existente.");
          },
          createQuotation: async () => {
            calls.push("create-quotation");
            return { id: "quotation-1", number: "COT-20260525-145607-A1B2C3" };
          },
          createQuotationItems: async () => {
            calls.push("create-items");
            throw new Error("No se pudieron guardar los items de la cotizacion.");
          },
          deleteQuotation: async (quotationId) => {
            calls.push(`delete-quotation:${quotationId}`);
          },
          deleteClient: async (clientId) => {
            calls.push(`delete-client:${clientId}`);
          },
        },
        {
          values: {
            clientId: null,
            inlineClient: {
              name: "Obra Norte",
              email: null,
              phone: null,
              address: null,
            },
            notes: null,
            taxRate: 21,
            validUntil: null,
            items: [
              {
                catalogItemId: null,
                name: "Cemento",
                description: null,
                quantity: 1,
                unit: "bolsa",
                unitPrice: 1200,
              },
            ],
          },
          quotationNumber: "COT-20260525-145607-A1B2C3",
          subtotal: 1200,
          total: 1452,
        },
      ),
    /No se pudieron guardar los items de la cotizacion\./,
  );

  assert.deepEqual(calls, [
    "create-inline-client",
    "create-quotation",
    "create-items",
    "delete-quotation:quotation-1",
    "delete-client:client-inline",
  ]);
});

test("persistDraftQuotation surfaces quotation cleanup failures after the original error", async () => {
  await assert.rejects(
    () =>
      persistDraftQuotation(
        {
          createInlineClient: async () => ({
            id: "client-inline",
            name: "Obra Norte",
          }),
          getExistingClient: async () => {
            throw new Error("No deberia consultar un cliente existente.");
          },
          createQuotation: async () => ({
            id: "quotation-1",
            number: "COT-20260525-145607-A1B2C3",
          }),
          createQuotationItems: async () => {
            throw new Error("No se pudieron guardar los items de la cotizacion.");
          },
          deleteQuotation: async () => {
            throw new Error("rollback failed");
          },
          deleteClient: async () => {},
        },
        {
          values: {
            clientId: null,
            inlineClient: {
              name: "Obra Norte",
              email: null,
              phone: null,
              address: null,
            },
            notes: null,
            taxRate: 21,
            validUntil: null,
            items: [
              {
                catalogItemId: null,
                name: "Cemento",
                description: null,
                quantity: 1,
                unit: "bolsa",
                unitPrice: 1200,
              },
            ],
          },
          quotationNumber: "COT-20260525-145607-A1B2C3",
          subtotal: 1200,
          total: 1452,
        },
      ),
    /No se pudieron guardar los items de la cotizacion\. Tambien fallo la limpieza automatica de cotizacion\./,
  );
});

test("deleteQuotationAttachmentWithCleanup stops before deleting the DB row when storage deletion fails", async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      deleteQuotationAttachmentWithCleanup(
        {
          getAttachment: async () => ({
            id: "attachment-1",
            quotation_id: "quotation-1",
            user_id: "user-1",
            file_path: "user-1/quotations/quotation-1/factura.pdf",
            file_name: "factura.pdf",
            file_type: "application/pdf",
            created_at: "2026-05-25T14:56:07.000Z",
          }),
          assertCanMutateQuotation: async (quotationId) => {
            calls.push(`validate-draft:${quotationId}`);
          },
          removeAttachmentFile: async (path) => {
            calls.push(`remove-file:${path}`);
            throw new Error("storage failed");
          },
          deleteAttachmentRecord: async (attachmentId) => {
            calls.push(`delete-row:${attachmentId}`);
          },
        },
        "attachment-1",
      ),
    /No se pudo eliminar el adjunto\./,
  );

  assert.deepEqual(calls, [
    "validate-draft:quotation-1",
    "remove-file:user-1/quotations/quotation-1/factura.pdf",
  ]);
});

test("deleteQuotationAttachmentWithCleanup removes storage before deleting the DB row", async () => {
  const calls: string[] = [];

  await deleteQuotationAttachmentWithCleanup(
    {
      getAttachment: async () => ({
        id: "attachment-1",
        quotation_id: "quotation-1",
        user_id: "user-1",
        file_path: "user-1/quotations/quotation-1/factura.pdf",
        file_name: "factura.pdf",
        file_type: "application/pdf",
        created_at: "2026-05-25T14:56:07.000Z",
      }),
      assertCanMutateQuotation: async (quotationId) => {
        calls.push(`validate-draft:${quotationId}`);
      },
      removeAttachmentFile: async (path) => {
        calls.push(`remove-file:${path}`);
      },
      deleteAttachmentRecord: async (attachmentId) => {
        calls.push(`delete-row:${attachmentId}`);
      },
    },
    "attachment-1",
  );

  assert.deepEqual(calls, [
    "validate-draft:quotation-1",
    "remove-file:user-1/quotations/quotation-1/factura.pdf",
    "delete-row:attachment-1",
  ]);
});

test("deleteQuotationAttachmentWithCleanup stops before touching storage when quotation is not draft", async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      deleteQuotationAttachmentWithCleanup(
        {
          getAttachment: async () => ({
            id: "attachment-1",
            quotation_id: "quotation-1",
            user_id: "user-1",
            file_path: "user-1/quotations/quotation-1/factura.pdf",
            file_name: "factura.pdf",
            file_type: "application/pdf",
            created_at: "2026-05-25T14:56:07.000Z",
          }),
          assertCanMutateQuotation: async () => {
            calls.push("validate-draft");
            throw new Error("La cotizacion no existe, no te pertenece o ya no se puede modificar.");
          },
          removeAttachmentFile: async (path) => {
            calls.push(`remove-file:${path}`);
          },
          deleteAttachmentRecord: async (attachmentId) => {
            calls.push(`delete-row:${attachmentId}`);
          },
        },
        "attachment-1",
      ),
    /La cotizacion no existe, no te pertenece o ya no se puede modificar\./,
  );

  assert.deepEqual(calls, ["validate-draft"]);
});

test("hydrateQuotationAttachments rebuilds signed urls from persisted attachment rows", async () => {
  const signedPaths: string[] = [];

  const attachments = await hydrateQuotationAttachments(
    {
      listAttachments: async () => [
        {
          id: "attachment-1",
          quotation_id: "quotation-1",
          user_id: "user-1",
          file_path: "user-1/quotations/quotation-1/frente.jpg",
          file_name: "frente.jpg",
          file_type: "image/jpeg",
          created_at: "2026-05-25T14:56:07.000Z",
        },
        {
          id: "attachment-2",
          quotation_id: "quotation-1",
          user_id: "user-1",
          file_path: "user-1/quotations/quotation-1/plano.pdf",
          file_name: "plano.pdf",
          file_type: "application/pdf",
          created_at: "2026-05-25T14:58:07.000Z",
        },
      ],
      createSignedUrl: async (path) => {
        signedPaths.push(path);
        return `https://signed.example/${encodeURIComponent(path)}`;
      },
    },
  );

  assert.deepEqual(attachments, [
    {
      id: "attachment-1",
      quotationId: "quotation-1",
      filePath: "user-1/quotations/quotation-1/frente.jpg",
      fileName: "frente.jpg",
      fileType: "image/jpeg",
      createdAt: "2026-05-25T14:56:07.000Z",
      url: "https://signed.example/user-1%2Fquotations%2Fquotation-1%2Ffrente.jpg",
    },
    {
      id: "attachment-2",
      quotationId: "quotation-1",
      filePath: "user-1/quotations/quotation-1/plano.pdf",
      fileName: "plano.pdf",
      fileType: "application/pdf",
      createdAt: "2026-05-25T14:58:07.000Z",
      url: "https://signed.example/user-1%2Fquotations%2Fquotation-1%2Fplano.pdf",
    },
  ]);
  assert.deepEqual(signedPaths, [
    "user-1/quotations/quotation-1/frente.jpg",
    "user-1/quotations/quotation-1/plano.pdf",
  ]);
});

test("loadDraftQuotationHydrationContext skips attachment loading for non-draft quotations", async () => {
  const calls: string[] = [];

  const result = await loadDraftQuotationHydrationContext({
    getDraftQuotation: async () => {
      calls.push("get-draft");
      return null;
    },
    getAttachments: async () => {
      calls.push("get-attachments");
      return [
        {
          id: "attachment-1",
          quotationId: "quotation-1",
          filePath: "user-1/quotations/quotation-1/frente.jpg",
          fileName: "frente.jpg",
          fileType: "image/jpeg",
          createdAt: "2026-05-25T14:56:07.000Z",
          url: "https://signed.example/frente.jpg",
        },
      ];
    },
  });

  assert.deepEqual(result, {
    draftQuotation: null,
    attachments: [],
  });
  assert.deepEqual(calls, ["get-draft"]);
});

test("getDraftQuotationEditorHref returns the normal reopen path only for drafts", () => {
  assert.equal(
    getDraftQuotationEditorHref({
      id: "quotation-1",
      status: " Draft ",
    }),
    "/cotizaciones/nueva?quotationId=quotation-1",
  );
  assert.equal(
    getDraftQuotationEditorHref({
      id: "quotation-2",
      status: "sent",
    }),
    null,
  );
});

test("rollbackUploadedQuotationAttachments reports cleanup failures instead of swallowing them", async () => {
  const calls: string[] = [];

  const cleanupFailures = await rollbackUploadedQuotationAttachments(
    {
      deleteAttachmentRecord: async (attachmentId) => {
        calls.push(`delete-row:${attachmentId}`);

        if (attachmentId === "attachment-1") {
          throw new Error("db failed");
        }
      },
      removeAttachmentFile: async (filePath) => {
        calls.push(`remove-file:${filePath}`);

        if (filePath.endsWith("frente.jpg")) {
          throw new Error("storage failed");
        }
      },
    },
    {
      createdAttachments: [
        {
          id: "attachment-1",
          filePath: "user-1/quotations/quotation-1/frente.jpg",
        },
      ],
      uploadedFilePaths: [
        "user-1/quotations/quotation-1/frente.jpg",
        "user-1/quotations/quotation-1/plano.pdf",
      ],
    },
  );

  assert.deepEqual(cleanupFailures, [
    "registro attachment-1",
    "archivo user-1/quotations/quotation-1/frente.jpg",
  ]);
  assert.deepEqual(calls, [
    "delete-row:attachment-1",
    "remove-file:user-1/quotations/quotation-1/frente.jpg",
    "remove-file:user-1/quotations/quotation-1/plano.pdf",
  ]);
  assert.equal(
    formatCleanupFailureMessage(
      "No se pudieron subir los adjuntos.",
      cleanupFailures,
    ),
    "No se pudieron subir los adjuntos. Tambien fallo la limpieza automatica de registro attachment-1 y archivo user-1/quotations/quotation-1/frente.jpg.",
  );
});
