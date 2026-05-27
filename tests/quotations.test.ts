import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDraftQuotationMutationAllowed,
  assertSingleQuotationRollbackMutation,
  buildQuotationSharePath,
  buildWhatsAppShareHref,
  buildQuotationItemInsertRows,
  buildQuotationNumber,
  canHydrateQuotationEditorStatus,
  confirmQuotationWhatsappShare,
  deleteQuotationAttachmentWithCleanup,
  formatCleanupFailureMessage,
  getDraftQuotationEditorHref,
  getWhatsAppSharePhoneState,
  hydrateCompleteQuotation,
  hydrateQuotationAttachments,
  loadDraftQuotationHydrationContext,
  normalizeQuotationStatus,
  parseQuotationFormData,
  persistDraftQuotation,
  publishQuotationSharePdf,
  rollbackUploadedQuotationAttachments,
  sanitizeDraftQuotationItems,
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
        name: "Cemento Portland",
        description: "Bolsa de 50 kg",
        quantity: 2,
        unit: "bolsa",
        unitPrice: 1299.5,
      },
    ],
  });
});

test("parseQuotationFormData rejects validity dates in the past", () => {
  const formData = new FormData();
  formData.set("client_mode", "existing");
  formData.set("client_id", "client-1");
  formData.set("tax_rate", "21");
  formData.set("valid_until", "2026-05-25");
  formData.set(
    "items_payload",
    JSON.stringify([{ name: "Servicio", quantity: 1, unit: "unidad", unitPrice: 1 }]),
  );

  assert.throws(
    () =>
      parseQuotationFormData(formData, {
        now: new Date("2026-05-26T12:00:00.000Z"),
      }),
    /La fecha de validez no puede estar en el pasado\./,
  );
});

test("parseQuotationFormData rejects validity dates beyond the allowed year window", () => {
  const formData = new FormData();
  formData.set("client_mode", "existing");
  formData.set("client_id", "client-1");
  formData.set("tax_rate", "21");
  formData.set("valid_until", "2032-01-01");
  formData.set(
    "items_payload",
    JSON.stringify([{ name: "Servicio", quantity: 1, unit: "unidad", unitPrice: 1 }]),
  );

  assert.throws(
    () =>
      parseQuotationFormData(formData, {
        now: new Date("2026-05-26T12:00:00.000Z"),
      }),
    /La fecha de validez no puede superar 5 años desde hoy\./,
  );
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
        name: "Mano De Obra",
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
    /Selecciona un cliente existente o crea uno nuevo dentro de la cotización\./,
  );
});

test("parseQuotationFormData rejects missing items", () => {
  const formData = new FormData();
  formData.set("client_mode", "inline");
  formData.set("client_payload", JSON.stringify({ name: "Cliente demo" }));
  formData.set("items_payload", JSON.stringify([]));

  assert.throws(
    () => parseQuotationFormData(formData),
    /Agrega al menos un ítem a la cotización antes de guardarla\./,
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
    /Cada ítem necesita un concepto, una cantidad válida y un precio válido\./,
  );
});

test("buildQuotationNumber uses a stable timestamp-based format", () => {
  assert.equal(
    buildQuotationNumber(new Date("2026-05-25T14:56:07.000Z"), "a1b2c3"),
    "COT-20260525-145607-A1B2C3",
  );
});

test("normalizeQuotationStatus keeps supported lifecycle values and maps legacy aliases", () => {
  assert.equal(normalizeQuotationStatus(" Draft "), "draft");
  assert.equal(normalizeQuotationStatus("pending"), "pending");
  assert.equal(normalizeQuotationStatus("accepted"), "accepted");
  assert.equal(normalizeQuotationStatus("rejected"), "rejected");
  assert.equal(normalizeQuotationStatus("expired"), "expired");
  assert.equal(normalizeQuotationStatus("sent"), "pending");
  assert.equal(normalizeQuotationStatus("approved"), "accepted");
  assert.equal(normalizeQuotationStatus("unknown"), null);
});

test("canHydrateQuotationEditorStatus keeps shared pending quotations visible in the locked editor", () => {
  assert.equal(canHydrateQuotationEditorStatus("draft"), true);
  assert.equal(canHydrateQuotationEditorStatus("pending"), true);
  assert.equal(canHydrateQuotationEditorStatus("accepted"), false);
  assert.equal(canHydrateQuotationEditorStatus("rejected"), false);
  assert.equal(canHydrateQuotationEditorStatus(null), false);
});

test("buildQuotationItemInsertRows preserves catalog linkage and calculated totals", () => {
  assert.deepEqual(
    buildQuotationItemInsertRows("quotation-1", [
      {
        catalogItemId: "catalog-1",
        name: "Cemento",
        description: "Bolsa de 50 kg",
        quantity: 2,
        unit: "bolsa",
        unitPrice: 1200,
      },
      {
        catalogItemId: null,
        name: "Flete",
        description: null,
        quantity: 1,
        unit: "servicio",
        unitPrice: 3500,
      },
    ]),
    [
      {
        quotation_id: "quotation-1",
        catalog_item_id: "catalog-1",
        position: 0,
        name: "Cemento",
        description: "Bolsa de 50 kg",
        quantity: 2,
        unit: "bolsa",
        unit_price: 1200,
        total: 2400,
      },
      {
        quotation_id: "quotation-1",
        catalog_item_id: null,
        position: 1,
        name: "Flete",
        description: null,
        quantity: 1,
        unit: "servicio",
        unit_price: 3500,
        total: 3500,
      },
    ],
  );
});

test("sanitizeDraftQuotationItems keeps only tenant-owned catalog ids without changing order", () => {
  assert.deepEqual(
    sanitizeDraftQuotationItems(
      [
        {
          catalogItemId: "catalog-1",
          name: "Cemento",
          description: null,
          quantity: 1,
          unit: "bolsa",
          unitPrice: 1200,
        },
        {
          catalogItemId: "foreign-catalog",
          name: "Arena",
          description: null,
          quantity: 2,
          unit: "m3",
          unitPrice: 800,
        },
        {
          catalogItemId: null,
          name: "Flete",
          description: null,
          quantity: 1,
          unit: "servicio",
          unitPrice: 3000,
        },
      ],
      new Set(["catalog-1"]),
    ),
    [
      {
        catalogItemId: "catalog-1",
        name: "Cemento",
        description: null,
        quantity: 1,
        unit: "bolsa",
        unitPrice: 1200,
      },
      {
        catalogItemId: null,
        name: "Arena",
        description: null,
        quantity: 2,
        unit: "m3",
        unitPrice: 800,
      },
      {
        catalogItemId: null,
        name: "Flete",
        description: null,
        quantity: 1,
        unit: "servicio",
        unitPrice: 3000,
      },
    ],
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
    /No se pudo revertir la cotización borrador\./,
  );
});

test("assertSingleQuotationRollbackMutation rejects missing client cleanup rows", () => {
  assert.throws(
    () => assertSingleQuotationRollbackMutation([], "client"),
    /No se pudo eliminar el cliente temporal creado para la cotización\./,
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
    /La cotización no existe, no te pertenece o ya no se puede modificar\./,
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
            throw new Error("No se pudo guardar la cotización borrador.");
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
    /No se pudo guardar la cotización borrador\./,
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
            throw new Error("No se pudieron guardar los ítems de la cotización.");
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
    /No se pudieron guardar los ítems de la cotización\./,
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
            throw new Error("No se pudieron guardar los ítems de la cotización.");
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
    /No se pudieron guardar los ítems de la cotización\. Tambien fallo la limpieza automatica de cotizacion\./,
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
            throw new Error("La cotización no existe, no te pertenece o ya no se puede modificar.");
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
    /La cotización no existe, no te pertenece o ya no se puede modificar\./,
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

test("hydrateCompleteQuotation returns a full business object with branding, customer, items and share metadata", async () => {
  const signedLogoPaths: string[] = [];

  const result = await hydrateCompleteQuotation({
    getQuotation: async () => ({
      id: "quotation-1",
      user_id: "user-1",
      client_id: "client-1",
      client_name: "Cliente Demo",
      number: "COT-20260525-145607-A1B2C3",
      status: "sent",
      notes: "Entregar en obra",
      subtotal: "2400.50",
      tax_rate: "21",
      total: "2904.61",
      valid_until: "2026-06-30",
      pdf_path: "user-1/quotations/quotation-1/cotizacion.pdf",
      pdf_generated_at: "2026-05-25T15:10:00.000Z",
      share_token: "share-token-1",
      sent_at: "2026-05-25T15:15:00.000Z",
      created_at: "2026-05-25T14:56:07.000Z",
    }),
    getProfile: async () => ({
      id: "user-1",
      business_name: "Pro Mat Mendoza",
      industry: "Materiales",
      logo_url: "logos/user-1/logo.png",
      phone: "2615551234",
      email: "ventas@promat.com",
      address: "Rodriguez Pena 3341",
      currency: "ARS",
      theme: "dark",
      created_at: "2026-01-01T00:00:00.000Z",
    }),
    getClient: async (clientId) => ({
      id: clientId,
      user_id: "user-1",
      name: "Cliente Demo",
      email: "cliente@demo.com",
      phone: "2614440000",
      address: "Obra central",
      created_at: "2026-05-01T00:00:00.000Z",
    }),
    getItems: async () => [
      {
        id: "item-2",
        quotation_id: "quotation-1",
        position: "1",
        catalog_item_id: null,
        name: "Flete",
        description: null,
        quantity: "1",
        unit: "servicio",
        unit_price: "400.00",
        total: "400.00",
      },
      {
        id: "item-1",
        quotation_id: "quotation-1",
        position: "0",
        catalog_item_id: "catalog-1",
        name: "Cemento",
        description: "Bolsa de 50 kg",
        quantity: "2",
        unit: "bolsa",
        unit_price: "1200.25",
        total: "2400.50",
      },
    ],
    createSignedLogoUrl: async (logoPath) => {
      signedLogoPaths.push(logoPath);
      return `https://signed.example/${encodeURIComponent(logoPath)}`;
    },
  });

  assert.deepEqual(result, {
    quotation: {
      id: "quotation-1",
      user_id: "user-1",
      client_id: "client-1",
      client_name: "Cliente Demo",
      number: "COT-20260525-145607-A1B2C3",
      status: "pending",
      notes: "Entregar en obra",
      subtotal: 2400.5,
      tax_rate: 21,
      total: 2904.61,
      valid_until: "2026-06-30",
      pdf_path: "user-1/quotations/quotation-1/cotizacion.pdf",
      pdf_generated_at: "2026-05-25T15:10:00.000Z",
      share_token: "share-token-1",
      sent_at: "2026-05-25T15:15:00.000Z",
      created_at: "2026-05-25T14:56:07.000Z",
    },
    branding: {
      businessName: "Pro Mat Mendoza",
      logoPath: "logos/user-1/logo.png",
      logoUrl:
        "https://signed.example/logos%2Fuser-1%2Flogo.png",
      phone: "2615551234",
      email: "ventas@promat.com",
      address: "Rodriguez Pena 3341",
      currency: "ARS",
      pdfFooter: null,
    },
    customer: {
      id: "client-1",
      name: "Cliente Demo",
      email: "cliente@demo.com",
      phone: "2614440000",
      address: "Obra central",
    },
    items: [
      {
        id: "item-1",
        quotationId: "quotation-1",
        position: 0,
        catalogItemId: "catalog-1",
        name: "Cemento",
        description: "Bolsa de 50 kg",
        quantity: 2,
        unit: "bolsa",
        unitPrice: 1200.25,
        total: 2400.5,
      },
      {
        id: "item-2",
        quotationId: "quotation-1",
        position: 1,
        catalogItemId: null,
        name: "Flete",
        description: null,
        quantity: 1,
        unit: "servicio",
        unitPrice: 400,
        total: 400,
      },
    ],
    output: {
      pdfPath: "user-1/quotations/quotation-1/cotizacion.pdf",
      pdfGeneratedAt: "2026-05-25T15:10:00.000Z",
      shareToken: "share-token-1",
      sentAt: "2026-05-25T15:15:00.000Z",
    },
  });
  assert.deepEqual(signedLogoPaths, ["logos/user-1/logo.png"]);
});

test("hydrateCompleteQuotation short-circuits when the quotation does not exist", async () => {
  const calls: string[] = [];

  const result = await hydrateCompleteQuotation({
    getQuotation: async () => {
      calls.push("get-quotation");
      return null;
    },
    getProfile: async () => {
      calls.push("get-profile");
      return null;
    },
    getClient: async () => {
      calls.push("get-client");
      return null;
    },
    getItems: async () => {
      calls.push("get-items");
      return [];
    },
    createSignedLogoUrl: async () => {
      calls.push("sign-logo");
      return null;
    },
  });

  assert.equal(result, null);
  assert.deepEqual(calls, ["get-quotation"]);
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

test("loadDraftQuotationHydrationContext preserves PDF and share metadata for reopened drafts", async () => {
  const result = await loadDraftQuotationHydrationContext({
    getDraftQuotation: async () => ({
      id: "quotation-1",
      number: "COT-20260525-145607-A1B2C3",
      status: "pending",
      pdf_path: "user-1/quotation-pdfs/quotation-1/cotizacion.pdf",
      pdf_generated_at: "2026-05-26T01:10:00.000Z",
      share_token: "share-token-1",
      sent_at: "2026-05-26T01:15:00.000Z",
    }),
    getAttachments: async () => [],
  });

  assert.deepEqual(result, {
    draftQuotation: {
      id: "quotation-1",
      number: "COT-20260525-145607-A1B2C3",
      status: "pending",
      pdf_path: "user-1/quotation-pdfs/quotation-1/cotizacion.pdf",
      pdf_generated_at: "2026-05-26T01:10:00.000Z",
      share_token: "share-token-1",
      sent_at: "2026-05-26T01:15:00.000Z",
    },
    attachments: [],
  });
});

test("getDraftQuotationEditorHref returns the normal reopen path only for drafts", () => {
  assert.equal(
    getDraftQuotationEditorHref({
      id: "quotation-1",
      status: "draft",
    }),
    "/cotizaciones/nueva?quotationId=quotation-1",
  );
  assert.equal(
    getDraftQuotationEditorHref({
      id: "quotation-2",
      status: "pending",
    }),
    null,
  );
});

test("buildQuotationSharePath generates a stable public PDF route for the share token", () => {
  assert.equal(
    buildQuotationSharePath("share-token-1"),
    "/api/quotations/share/share-token-1",
  );
});

test("buildWhatsAppShareHref targets a specific destination when the client phone exists", () => {
  assert.equal(
    buildWhatsAppShareHref({
      phone: "261 555 1234",
      text: "Te comparto la cotizacion",
    }),
    "https://wa.me/5492615551234?text=Te%20comparto%20la%20cotizacion",
  );
});

test("buildWhatsAppShareHref still returns a generic share flow without a destination", () => {
  assert.equal(
    buildWhatsAppShareHref({
      phone: null,
      text: "Te comparto la cotizacion",
    }),
    "https://wa.me/?text=Te%20comparto%20la%20cotizacion",
  );
});

test("buildWhatsAppShareHref falls back to the generic share flow when the stored phone is unsafe", () => {
  assert.equal(
    buildWhatsAppShareHref({
      phone: "555-1234",
      text: "Te comparto la cotizacion",
    }),
    "https://wa.me/?text=Te%20comparto%20la%20cotizacion",
  );
});

test("buildWhatsAppShareHref marks missing phones as requiring manual input before sharing", () => {
  assert.deepEqual(
    getWhatsAppSharePhoneState(null),
    {
      normalizedPhone: null,
      requiresPhoneInput: true,
    },
  );
});

test("buildWhatsAppShareHref accepts stored client phones when they normalize safely", () => {
  assert.deepEqual(
    getWhatsAppSharePhoneState("261 555 1234"),
    {
      normalizedPhone: "5492615551234",
      requiresPhoneInput: false,
    },
  );
});

test("confirmQuotationWhatsappShare creates the token and marks draft quotations as pending once sharing is confirmed", async () => {
  const persistedUpdates: Array<{
    shareToken: string;
    status: string | null;
    sentAt: string | null;
  }> = [];

  const result = await confirmQuotationWhatsappShare(
    {
      getQuotation: async () => ({
        id: "quotation-1",
        number: "COT-20260525-145607-A1B2C3",
        status: "draft",
        pdfPath: "user-1/quotation-pdfs/quotation-1/cotizacion.pdf",
        shareToken: null,
        sentAt: null,
        clientPhone: "5492615551234",
      }),
      persistShareState: async (values) => {
        persistedUpdates.push(values);
      },
      createShareToken: () => "share-token-1",
    },
    {
      quotationId: "quotation-1",
      now: new Date("2026-05-26T01:25:00.000Z"),
    },
  );

  assert.deepEqual(persistedUpdates, [
    {
      shareToken: "share-token-1",
      status: "pending",
      sentAt: "2026-05-26T01:25:00.000Z",
    },
  ]);
  assert.deepEqual(result, {
    quotationId: "quotation-1",
    quotationNumber: "COT-20260525-145607-A1B2C3",
    shareToken: "share-token-1",
    sharePath: "/api/quotations/share/share-token-1",
    shareStatus: "pending",
    sentAt: "2026-05-26T01:25:00.000Z",
    clientPhone: "5492615551234",
  });
});

test("confirmQuotationWhatsappShare reuses existing share metadata without persisting again", async () => {
  const persistedUpdates: string[] = [];

  const result = await confirmQuotationWhatsappShare(
    {
      getQuotation: async () => ({
        id: "quotation-1",
        number: "COT-20260525-145607-A1B2C3",
        status: "pending",
        pdfPath: "user-1/quotation-pdfs/quotation-1/cotizacion.pdf",
        shareToken: "share-token-1",
        sentAt: "2026-05-26T01:25:00.000Z",
        clientPhone: null,
      }),
      persistShareState: async () => {
        persistedUpdates.push("persist");
      },
      createShareToken: () => {
        throw new Error("No deberia generar un token nuevo.");
      },
    },
    {
      quotationId: "quotation-1",
      now: new Date("2026-05-26T01:30:00.000Z"),
    },
  );

  assert.deepEqual(persistedUpdates, []);
  assert.deepEqual(result, {
    quotationId: "quotation-1",
    quotationNumber: "COT-20260525-145607-A1B2C3",
    shareToken: "share-token-1",
    sharePath: "/api/quotations/share/share-token-1",
    shareStatus: "pending",
    sentAt: "2026-05-26T01:25:00.000Z",
    clientPhone: null,
  });
});

test("confirmQuotationWhatsappShare returns a generic share flow when the stored phone cannot be normalized safely", async () => {
  const result = await confirmQuotationWhatsappShare(
    {
      getQuotation: async () => ({
        id: "quotation-1",
        number: "COT-20260525-145607-A1B2C3",
        status: "pending",
        pdfPath: "user-1/quotation-pdfs/quotation-1/cotizacion.pdf",
        shareToken: "share-token-1",
        sentAt: "2026-05-26T01:25:00.000Z",
        clientPhone: "555-1234",
      }),
      persistShareState: async () => {
        throw new Error("No deberia intentar persistir de nuevo.");
      },
      createShareToken: () => {
        throw new Error("No deberia generar un token nuevo.");
      },
    },
    {
      quotationId: "quotation-1",
      now: new Date("2026-05-26T01:30:00.000Z"),
    },
  );

  assert.equal(result.clientPhone, null);
});

test("confirmQuotationWhatsappShare rejects attempts to share quotations without a generated PDF", async () => {
  await assert.rejects(
    () =>
      confirmQuotationWhatsappShare(
        {
          getQuotation: async () => ({
            id: "quotation-1",
            number: "COT-20260525-145607-A1B2C3",
            status: "draft",
            pdfPath: null,
            shareToken: null,
            sentAt: null,
            clientPhone: "5492615551234",
          }),
          persistShareState: async () => {},
          createShareToken: () => "share-token-1",
        },
        {
          quotationId: "quotation-1",
        },
      ),
    /Genera el PDF antes de compartir la cotización\./,
  );
});

test("publishQuotationSharePdf uploads a public PDF copy keyed by the share token", async () => {
  const uploads: Array<{
    path: string;
    body: Uint8Array;
    contentType: string;
    upsert: boolean;
  }> = [];

  const result = await publishQuotationSharePdf(
    {
      getStoredPdf: async () => ({
        fileName: "cotizacion-demo.pdf",
        bytes: Uint8Array.from([4, 5, 6]),
      }),
      uploadSharedPdf: async (input) => {
        uploads.push(input);
      },
    },
    {
      userId: "user-1",
      shareToken: "share-token-1",
    },
  );

  assert.deepEqual(result, {
    fileName: "cotizacion-demo.pdf",
    path: "user-1/quotation-share-pdfs/share-token-1.pdf",
  });
  assert.deepEqual(uploads, [
    {
      path: "user-1/quotation-share-pdfs/share-token-1.pdf",
      body: Uint8Array.from([4, 5, 6]),
      contentType: "application/pdf",
      upsert: true,
    },
  ]);
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
