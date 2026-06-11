import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildBusinessChatExpenseSnapshot,
  buildBusinessChatSystemPrompt,
  buildBusinessChatContext,
  filterExpensesByPeriod,
  filterQuotationsByPeriod,
  attachClientSelectorUiHint,
  normalizeBusinessChatResult,
  resolveSelectedClientFromRequest,
  readChatRequestBody,
  resolveExpensePeriodFilter,
  resolveQuotationPeriodFilter,
  shouldLoadExpenseDetails,
} from "../lib/ai/chat";
import { getOpenAIClient } from "../lib/ai/openai";
import { getNextPendingSuggestion } from "../lib/chat/pending-suggestion";
import type { CatalogItem, Client, Expense, Profile, Quotation } from "../types";

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

function createExpense(id: number, amount: number, date: string): Expense {
  return {
    id: `expense-${id}`,
    user_id: "user-1",
    description: `Gasto ${id}`,
    amount,
    currency: "ARS",
    category: id % 2 === 0 ? "Materiales" : "Transporte",
    date,
    receipt_url: null,
    receipt_path: null,
    notes: null,
    created_at: `${date}T10:00:00.000Z`,
  };
}

function createQuotation(id: number, status: Quotation["status"]): Quotation {
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
    pdf_path: null,
    pdf_generated_at: null,
    share_token: null,
    sent_at: null,
    created_at: `2026-05-${String(id).padStart(2, "0")}T12:00:00.000Z`,
  };
}

test("resolveQuotationPeriodFilter detects day, week and month prompts", () => {
  assert.equal(resolveQuotationPeriodFilter("¿Cuántas cotizaciones hice hoy?"), "day");
  assert.equal(resolveQuotationPeriodFilter("Resumen de esta semana"), "week");
  assert.equal(resolveQuotationPeriodFilter("Cotizaciones del mes actual"), "month");
  assert.equal(resolveQuotationPeriodFilter("Mostrame el catálogo"), null);
});

test("filterQuotationsByPeriod scopes quotations to the requested window", () => {
  const quotations = [
    createQuotation(1, "draft"),
    {
      ...createQuotation(2, "pending"),
      created_at: "2026-05-01T12:00:00.000Z",
    },
    {
      ...createQuotation(3, "accepted"),
      created_at: "2026-04-20T12:00:00.000Z",
    },
  ];

  const filtered = filterQuotationsByPeriod(
    quotations,
    "month",
    new Date("2026-05-26T12:00:00.000Z"),
  );

  assert.equal(filtered.length, 2);
});

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

  const clientRows = Array.from({ length: 8 }, (_, index) => createClient(index + 1));
  const availableClients = clientRows.map((client) => ({
    id: client.id,
    nombre: client.name,
    email: client.email,
    telefono: client.phone,
  }));

  const context = buildBusinessChatContext({
    profile,
    clients: clientRows,
    availableClients,
    catalogItems: Array.from({ length: 10 }, (_, index) =>
      createCatalogItem(index + 1),
    ),
    quotations: [
      createQuotation(1, "draft"),
      createQuotation(2, "pending"),
      createQuotation(3, "draft"),
      createQuotation(4, "accepted"),
      createQuotation(5, "draft"),
      createQuotation(6, "pending"),
      createQuotation(7, "draft"),
    ],
  });

  assert.deepEqual(context.business, {
    businessName: "Pro Mat Mendoza",
    industry: "Materiales de construccion",
    currency: "ARS",
    contactEmail: "ventas@promat.com",
  });
  assert.equal(context.meta.currentDate.length, 10);
  assert.equal(context.meta.quotationPeriodFilter, null);
  assert.deepEqual(context.summary, {
    totalClients: 8,
    totalCatalogItems: 10,
    totalQuotations: 7,
    filteredQuotations: 7,
    quotationStatusBreakdown: {
      accepted: 1,
      draft: 4,
      pending: 2,
    },
  });
  assert.equal(context.recentClients.length, 8);
  assert.equal(context.availableClients.length, 8);
  assert.equal(context.selectedClient, null);
  assert.equal(context.recentCatalogItems.length, 8);
  assert.equal(context.recentQuotations.length, 6);
  assert.match(context.recentQuotations[0]!.notes ?? "", /^Necesita entrega urgente/);
  assert.ok(
    (context.recentQuotations[0]!.notes ?? "").length < 120,
    "Expected quotation notes to be truncated in bounded context.",
  );
  assert.equal(context.expenses.period, "month");
  assert.equal(context.expenses.expenseCount, 0);
});

test("buildBusinessChatExpenseSnapshot summarizes totals, categories and net profit", () => {
  const profile: Profile = {
    id: "user-1",
    business_name: "Pro Mat",
    industry: null,
    logo_url: null,
    phone: null,
    email: null,
    address: null,
    currency: "ARS",
    theme: null,
    created_at: null,
  };

  const snapshot = buildBusinessChatExpenseSnapshot({
    profile,
    period: "month",
    referenceDate: new Date("2026-05-26T12:00:00.000Z"),
    expenses: [
      createExpense(1, 5000, "2026-05-10"),
      createExpense(2, 12000, "2026-05-20"),
      createExpense(3, 3000, "2026-04-15"),
    ],
    quotations: [
      {
        ...createQuotation(1, "accepted"),
        total: 50000,
        created_at: "2026-05-12T12:00:00.000Z",
      },
    ],
  });

  assert.equal(snapshot.expenseCount, 2);
  assert.equal(snapshot.totalsByCurrency[0]?.total, 17000);
  assert.equal(snapshot.largestExpense?.amount, 12000);
  assert.equal(snapshot.latestExpense?.id, "expense-2");
  assert.equal(snapshot.profitability.acceptedQuotedTotal, 50000);
  assert.equal(snapshot.profitability.netProfit, 33000);
  assert.equal(snapshot.profitability.canCalculateNetProfit, true);
});

test("filterExpensesByPeriod scopes expenses to the requested window", () => {
  const expenses = [
    createExpense(1, 1000, "2026-05-26"),
    createExpense(2, 2000, "2026-05-01"),
    createExpense(3, 3000, "2026-04-20"),
  ];

  const filtered = filterExpensesByPeriod(
    expenses,
    "month",
    new Date("2026-05-26T12:00:00.000Z"),
  );

  assert.equal(filtered.length, 2);
});

test("shouldLoadExpenseDetails detects expense-related prompts", () => {
  assert.equal(shouldLoadExpenseDetails("¿Cuánto gasté este mes?"), true);
  assert.equal(shouldLoadExpenseDetails("¿Cuál fue mi mayor gasto?"), true);
  assert.equal(resolveExpensePeriodFilter("Ganancia neta del mes"), "month");
  assert.equal(shouldLoadExpenseDetails("Mostrame el catálogo"), false);
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

test("normalizeBusinessChatResult keeps a valid expense create suggestion", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "Te dejo el gasto listo para confirmar.",
      suggestedAction: {
        type: "expense_create",
        description: " Carga de combustible ",
        amount: "2000,50",
        currency: "ARS",
        category: "Combustible",
        date: "2026-05-27",
      },
    },
    {
      clients: [],
      catalogItems: [],
    },
  );

  assert.deepEqual(result.suggestedAction, {
    type: "expense_create",
    description: "Carga de combustible",
    amount: 2000.5,
    currency: "ARS",
    category: "Combustible",
    date: "2026-05-27",
    notes: null,
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

test("normalizeBusinessChatResult matches quotation drafts by client name when id is missing", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "Preparo el borrador para el cliente elegido.",
      suggestedAction: {
        type: "draft_quotation_create",
        clientName: "Cliente 2",
        items: [
          {
            name: "Arena",
            quantity: 2,
            unit: "bolsa",
            unitPrice: 1500,
          },
        ],
      },
    },
    {
      clients: [createClient(1), createClient(2)],
      catalogItems: [],
    },
  );

  assert.equal(result.suggestedAction?.type, "draft_quotation_create");
  assert.equal(
    result.suggestedAction?.type === "draft_quotation_create"
      ? result.suggestedAction.clientId
      : null,
    "client-2",
  );
});

test("normalizeBusinessChatResult rejects quotation drafts without a valid existing client", () => {
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

  assert.equal(result.suggestedAction, null);
  assert.match(result.reply, /cliente/i);
});

test("normalizeBusinessChatResult blocks false save replies on quotation create intent", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "Quedó lista la cotización para tu cliente.",
      suggestedAction: null,
    },
    {
      clients: [createClient(1)],
      catalogItems: [],
    },
    {
      userPrompt: "Creame una cotización",
    },
  );

  assert.equal(result.suggestedAction, null);
  assert.match(result.reply, /Todavía no guardé nada/i);
});

test("normalizeBusinessChatResult keeps intermediate replies after client selection", () => {
  const result = normalizeBusinessChatResult(
    {
      reply: "Quedó lista la cotización para tu cliente.",
      suggestedAction: null,
    },
    {
      clients: [createClient(1)],
      catalogItems: [],
    },
    {
      userPrompt: "Cliente seleccionado: Alejandro Leonangeli",
    },
  );

  assert.equal(result.suggestedAction, null);
  assert.match(result.reply, /Quedó lista la cotización/i);
});

test("resolveSelectedClientFromRequest returns only clients from available list", () => {
  const clients = [
    {
      id: "client-1",
      nombre: "Cliente 1",
      email: null,
      telefono: null,
    },
  ];

  assert.deepEqual(resolveSelectedClientFromRequest("client-1", clients), clients[0]);
  assert.equal(resolveSelectedClientFromRequest("client-missing", clients), null);
  assert.equal(resolveSelectedClientFromRequest(123, clients), null);
});

test("attachClientSelectorUiHint upgrades plain client list replies", () => {
  const clients = [
    {
      id: "client-1",
      nombre: "Cliente 1",
      email: null,
      telefono: null,
    },
  ];

  const payload = attachClientSelectorUiHint(
    {
      reply: "Estos son tus clientes:\n1. Cliente 1",
      suggestedAction: null,
    },
    clients,
  );

  assert.equal(payload.uiHint?.type, "client_selector");
  assert.equal(payload.reply, "¿Para cuál cliente es la cotización?");
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
  assert.match(prompt, /clientes, catálogo, cotizaciones, gastos y perfil/i);
  assert.match(prompt, /herramientas reales/i);
  assert.match(prompt, /FLUJO OBLIGATORIO PARA COTIZACIONES/i);
  assert.match(prompt, /availableClients/i);
  assert.match(prompt, /NUNCA inventes un cliente nuevo/i);
  assert.match(prompt, /fecha = hoy y moneda = la del perfil/i);
  assert.match(prompt, /confirmación explícita/i);
  assert.match(prompt, /draft_quotation_create, expense_create y catalog_price_update/i);
  assert.match(prompt, /NUNCA digas que ya guardaste/i);
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
      assert.equal(error.message, "El cuerpo JSON del chat es inválido.");
      assert.equal((error as Error & { status?: number }).status, 400);
      return true;
    },
  );
});

test("getOpenAIClient falls back to .env.local when process env is stale", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalCwd = process.cwd();
  const tempDir = mkdtempSync(join(tmpdir(), "cotizapp-openai-"));

  writeFileSync(
    join(tempDir, ".env.local"),
    'OPENAI_API_KEY="test-openai-key-from-dotenv-local"\n',
    "utf8",
  );
  delete process.env.OPENAI_API_KEY;
  process.chdir(tempDir);

  try {
    const client = getOpenAIClient();
    assert.ok(client, "Expected an OpenAI client to be created from .env.local.");
  } finally {
    process.chdir(originalCwd);

    if (typeof originalApiKey === "string") {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});
