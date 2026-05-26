import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBusinessChatSystemPrompt,
  buildBusinessChatContext,
  normalizeBusinessChatResult,
  readChatRequestBody,
} from "../lib/ai/chat";
import { getNextPendingSuggestion } from "../lib/chat/pending-suggestion";
import type { CatalogItem, Client, Profile, Quotation } from "../types";

function createClient(id: number): Client {
  return {
    id: `client-${id}`,
    user_id: "user-1",
    name: `Cliente ${id}`,
    email: `cliente${id}@demo.com`,
    phone: `26100000${id}`,
    address: `Direccion ${id}`,
    created_at: `2026-05-${String(id).padStart(2, "0")}T10:00:00.000Z`,
  };
}

function createCatalogItem(id: number): CatalogItem {
  return {
    id: `item-${id}`,
    user_id: "user-1",
    name: `Producto ${id}`,
    description: `Descripcion ${id}`,
    unit: "unidad",
    price: id * 1000,
    category: id % 2 === 0 ? "Materiales" : "Herramientas",
    created_at: `2026-05-${String(id).padStart(2, "0")}T11:00:00.000Z`,
  };
}

function createQuotation(id: number, status: string): Quotation {
  return {
    id: `quotation-${id}`,
    user_id: "user-1",
    client_id: `client-${id}`,
    client_name: `Cliente ${id}`,
    number: `COT-20260525-10000${id}-ABC${id}`,
    status,
    notes:
      id === 1
        ? "Necesita entrega urgente en obra con observaciones extensas que deben truncarse para no mandar demasiado contexto al modelo en una sola solicitud."
        : `Notas ${id}`,
    subtotal: id * 10000,
    tax_rate: 21,
    total: id * 12100,
    valid_until: "2026-06-30",
    created_at: `2026-05-${String(id).padStart(2, "0")}T12:00:00.000Z`,
  };
}

test("buildBusinessChatContext limits lists and summarizes account activity", () => {
  const profile: Profile = {
    id: "user-1",
    business_name: " Pro Mat Mendoza ",
    industry: "Materiales de construccion",
    logo_url: null,
    phone: "2615551234",
    email: "ventas@promat.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
    theme: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };

  const context = buildBusinessChatContext({
    profile,
    clients: Array.from({ length: 8 }, (_, index) => createClient(index + 1)),
    catalogItems: Array.from({ length: 10 }, (_, index) =>
      createCatalogItem(index + 1),
    ),
    quotations: [
      createQuotation(1, "draft"),
      createQuotation(2, "sent"),
      createQuotation(3, "draft"),
      createQuotation(4, "accepted"),
      createQuotation(5, "draft"),
      createQuotation(6, "sent"),
      createQuotation(7, "draft"),
    ],
  });

  assert.deepEqual(context.business, {
    businessName: "Pro Mat Mendoza",
    industry: "Materiales de construccion",
    currency: "ARS",
    contactEmail: "ventas@promat.com",
  });
  assert.deepEqual(context.summary, {
    totalClients: 8,
    totalCatalogItems: 10,
    totalQuotations: 7,
    quotationStatusBreakdown: {
      accepted: 1,
      draft: 4,
      sent: 2,
    },
  });
  assert.equal(context.recentClients.length, 6);
  assert.equal(context.recentCatalogItems.length, 8);
  assert.equal(context.recentQuotations.length, 6);
  assert.match(context.recentQuotations[0]!.notes ?? "", /^Necesita entrega urgente/);
  assert.ok(
    (context.recentQuotations[0]!.notes ?? "").length < 120,
    "Expected quotation notes to be truncated in bounded context.",
  );
});

test("normalizeBusinessChatResult keeps a valid quotation draft suggestion in Spanish", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "  Puedo dejarte un borrador listo para revisar antes de guardarlo.  ",
      suggestedAction: {
        type: "draft_quotation_create",
        clientId: "client-2",
        clientName: " Cliente 2 ",
        notes: "  Entrega en 48 horas ",
        items: [
          {
            catalogItemId: "item-1",
            name: " Cemento portland ",
            description: " Bolsa x 50 kg ",
            quantity: "2",
            unit: " bolsa ",
            unitPrice: "14500,50",
          },
          {
            catalogItemId: "item-999",
            name: "",
            quantity: 0,
            unitPrice: -10,
          },
        ],
      },
    },
    {
      clients: [createClient(1), createClient(2)],
      catalogItems: [createCatalogItem(1), createCatalogItem(2)],
    },
  );

  assert.equal(
    result.reply,
    "Puedo dejarte un borrador listo para revisar antes de guardarlo.",
  );
  assert.deepEqual(result.suggestedAction, {
    type: "draft_quotation_create",
    clientId: "client-2",
    clientName: "Cliente 2",
    clientSource: "existing",
    notes: "Entrega en 48 horas",
    items: [
      {
        catalogItemId: "item-1",
        name: "Cemento portland",
        description: "Bolsa x 50 kg",
        quantity: 2,
        unit: "bolsa",
        unitPrice: 14500.5,
      },
    ],
  });
});

test("normalizeBusinessChatResult keeps only safe catalog price updates", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "Conviene revisar el precio del producto detectado.",
      suggestedAction: {
        type: "catalog_price_update",
        itemId: "item-3",
        itemName: " Nombre inventado por el modelo ",
        currentPrice: "999999",
        suggestedPrice: "3525,75",
        reason: "  Alineado con el ultimo costo del proveedor. ",
      },
    },
    {
      clients: [],
      catalogItems: [createCatalogItem(3)],
    },
  );

  assert.deepEqual(result.suggestedAction, {
    type: "catalog_price_update",
    itemId: "item-3",
    itemName: "Producto 3",
    currentPrice: 3000,
    suggestedPrice: 3525.75,
    reason: "Alineado con el ultimo costo del proveedor.",
  });
});

test("normalizeBusinessChatResult uses canonical client data for existing client suggestions", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "Puedo prepararlo para un cliente existente.",
      suggestedAction: {
        type: "draft_quotation_create",
        clientId: "client-2",
        clientName: " Etiqueta inventada ",
        items: [
          {
            name: "Arena",
            quantity: 3,
            unit: "bolsa",
            unitPrice: 1200,
          },
        ],
      },
    },
    {
      clients: [createClient(2)],
      catalogItems: [],
    },
  );

  assert.deepEqual(result.suggestedAction, {
    type: "draft_quotation_create",
    clientId: "client-2",
    clientName: "Cliente 2",
    clientSource: "existing",
    notes: null,
    items: [
      {
        catalogItemId: null,
        name: "Arena",
        description: null,
        quantity: 3,
        unit: "bolsa",
        unitPrice: 1200,
      },
    ],
  });
});

test("normalizeBusinessChatResult makes inline client creation explicit when client id is invalid", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "Puedo dejarlo listo con un cliente nuevo.",
      suggestedAction: {
        type: "draft_quotation_create",
        clientId: "client-missing",
        clientName: " Obra Sanchez ",
        notes: " Crear cliente nuevo antes del borrador ",
        items: [
          {
            name: "Cemento",
            quantity: 5,
            unit: "bolsa",
            unitPrice: 10000,
          },
        ],
      },
    },
    {
      clients: [createClient(1)],
      catalogItems: [],
    },
  );

  assert.deepEqual(result.suggestedAction, {
    type: "draft_quotation_create",
    clientId: null,
    clientName: "Obra Sanchez",
    clientSource: "inline",
    notes: "Crear cliente nuevo antes del borrador",
    items: [
      {
        catalogItemId: null,
        name: "Cemento",
        description: null,
        quantity: 5,
        unit: "bolsa",
        unitPrice: 10000,
      },
    ],
  });
});

test("normalizeBusinessChatResult removes unsupported or unsafe suggestions", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "Te comparto una recomendacion general.",
      suggestedAction: {
        type: "catalog_price_update",
        itemId: "item-missing",
        suggestedPrice: -100,
      },
    },
    {
      clients: [],
      catalogItems: [createCatalogItem(1)],
    },
  );

  assert.deepEqual(result, {
    reply: "Te comparto una recomendacion general.",
    suggestedAction: null,
  });
});

test("getNextPendingSuggestion clears stale confirmations when a new turn starts or fails", () => {
  const existingSuggestion = normalizeBusinessChatResult(
    {
      reply: "Puedo dejarte un borrador listo para revisar antes de guardarlo.",
      suggestedAction: {
        type: "draft_quotation_create",
        clientId: "client-2",
        clientName: "Cliente 2",
        items: [
          {
            name: "Cemento",
            quantity: 2,
            unit: "bolsa",
            unitPrice: 10000,
          },
        ],
      },
    },
    {
      clients: [createClient(2)],
      catalogItems: [],
    },
  ).suggestedAction;

  assert.ok(existingSuggestion, "Expected a valid pending suggestion for the setup.");
  assert.equal(getNextPendingSuggestion({ type: "submit" }), null);
  assert.equal(getNextPendingSuggestion({ type: "error" }), null);
});

test("getNextPendingSuggestion keeps only the latest response suggestion", () => {
  const latestSuggestion = normalizeBusinessChatResult(
    {
      reply: "Conviene revisar el precio del producto detectado.",
      suggestedAction: {
        type: "catalog_price_update",
        itemId: "item-3",
        suggestedPrice: "3525,75",
        reason: "Alineado con el ultimo costo del proveedor.",
      },
    },
    {
      clients: [],
      catalogItems: [createCatalogItem(3)],
    },
  ).suggestedAction;

  assert.deepEqual(
    getNextPendingSuggestion({
      type: "response",
      suggestedAction: latestSuggestion,
    }),
    latestSuggestion,
  );
  assert.equal(
    getNextPendingSuggestion({
      type: "response",
      suggestedAction: null,
    }),
    null,
  );
});

test("buildBusinessChatSystemPrompt keeps the assistant inside the business scope", () => {
  const prompt = buildBusinessChatSystemPrompt();

  assert.match(prompt, /solo dentro de este alcance/i);
  assert.match(prompt, /clientes, catalogo, cotizaciones y perfil/i);
  assert.match(prompt, /rechaza|rechazar|indica que esta fuera de alcance/i);
});

test("readChatRequestBody returns a 400 error for malformed json", async () => {
  await assert.rejects(
    () =>
      readChatRequestBody({
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "El cuerpo JSON del chat es invalido.");
      assert.equal((error as Error & { status?: number }).status, 400);
      return true;
    },
  );
});
