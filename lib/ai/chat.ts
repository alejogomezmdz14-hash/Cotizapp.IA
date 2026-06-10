import { normalizeCatalogUnit } from "@/lib/catalog-units";
import { getOpenAIApiKey, getOpenAIClient } from "@/lib/ai/openai";
import {
  formatClientesListForChatReply,
  type ChatClientListItem,
} from "@/lib/chat/client-list-format";
import { normalizeExpenseCategory } from "@/lib/expense-categories";
import type {
  CatalogItem,
  ChatConversationMessage,
  ChatExpenseCreateAction,
  ChatReplyPayload,
  ChatSuggestedAction,
  ChatSuggestedQuotationItem,
  Client,
  Expense,
  ExpenseCurrencyTotal,
  Profile,
  Quotation,
} from "@/types";

const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const MAX_CONTEXT_CATALOG_ITEMS = 8;
const MAX_CONTEXT_QUOTATIONS = 6;
const MAX_CONTEXT_EXPENSES = 6;
const MAX_HISTORY_MESSAGES = 8;
const MAX_NOTES_LENGTH = 96;

const FALSE_SAVE_REPLY_PATTERN =
  /\b(y[aá]|listo|guard[eé]|cre[eé]|registr[eé]|actualic[eé])\b.*\b(cotizaci[oó]n|borrador|gasto)\b/i;

type BusinessChatContextInput = {
  profile: Profile | null;
  clients: Client[];
  availableClients: ChatClientListItem[];
  catalogItems: CatalogItem[];
  quotations: Quotation[];
  expenses?: BusinessChatExpenseSnapshot | null;
};

type BusinessChatReferences = {
  clients: Client[];
  catalogItems: CatalogItem[];
};

type ChatRequestBody = {
  messages?: unknown;
};

export type QuotationPeriodFilter = "day" | "week" | "month";

export type BusinessChatContext = {
  meta: {
    currentDate: string;
    timezone: string;
    quotationPeriodFilter: QuotationPeriodFilter | null;
  };
  business: {
    businessName: string | null;
    industry: string | null;
    currency: string | null;
    contactEmail: string | null;
  };
  summary: {
    totalClients: number;
    totalCatalogItems: number;
    totalQuotations: number;
    filteredQuotations: number;
    quotationStatusBreakdown: Record<string, number>;
  };
  recentClients: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  availableClients: ChatClientListItem[];
  recentCatalogItems: Array<{
    id: string;
    name: string;
    category: string | null;
    unit: string;
    price: number;
  }>;
  recentQuotations: Array<{
    id: string;
    number: string;
    status: string | null;
    clientName: string | null;
    total: number;
    validUntil: string | null;
    createdAt: string | null;
    notes: string | null;
  }>;
  expenses: BusinessChatExpenseSnapshot;
};

export type BusinessChatExpenseLine = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
};

export type BusinessChatExpenseSnapshot = {
  period: QuotationPeriodFilter | "month";
  expenseCount: number;
  totalsByCurrency: ExpenseCurrencyTotal[];
  totalsByCategory: Array<{ category: string; total: number }>;
  latestExpense: BusinessChatExpenseLine | null;
  largestExpense: BusinessChatExpenseLine | null;
  recentExpenses: BusinessChatExpenseLine[];
  profitability: {
    acceptedQuotedTotal: number;
    netProfit: number | null;
    netProfitCurrency: string | null;
    canCalculateNetProfit: boolean;
    note: string | null;
  };
};

export function isQuotationCreateIntent(prompt: string) {
  const normalizedPrompt = prompt.trim().toLowerCase();

  if (!normalizedPrompt) {
    return false;
  }

  return /(cotizaci[oó]n|cotizar|armame|haceme|crea(r)?|genera(r)?|nueva).*(cotizaci[oó]n|cliente|items?|producto|servicio)?/i.test(
    normalizedPrompt,
  ) || /\bcotizaci[oó]n\b/i.test(normalizedPrompt);
}

function sanitizeChatReply(
  reply: string,
  suggestedAction: ChatSuggestedAction | null,
) {
  if (suggestedAction) {
    return reply;
  }

  if (!FALSE_SAVE_REPLY_PATTERN.test(reply)) {
    return reply;
  }

  return "Todavía no guardé nada en tu cuenta. Si querés crear una cotización, primero elegí un cliente de tu lista y después confirmame con «sí» cuando veas el preview.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function truncateText(value: string | null, maxLength: number) {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 3, 1)).trimEnd()}...`;
}

function parseDecimal(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const compactValue = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!compactValue || !/\d/.test(compactValue)) {
    return null;
  }

  const lastCommaIndex = compactValue.lastIndexOf(",");
  const lastDotIndex = compactValue.lastIndexOf(".");
  let normalizedValue = compactValue;

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
    normalizedValue = compactValue
      .replace(thousandsSeparator, "")
      .replace(decimalSeparator, ".");
  } else if (lastCommaIndex !== -1) {
    normalizedValue = compactValue.replace(",", ".");
  }

  if (!/^-?\d+(?:\.\d+)?$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function extractJsonObjectFromText(content: string) {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    throw new Error("OpenAI no devolvio contenido para el chat.");
  }

  try {
    return JSON.parse(trimmedContent) as unknown;
  } catch {
    const firstBraceIndex = trimmedContent.indexOf("{");
    const lastBraceIndex = trimmedContent.lastIndexOf("}");

    if (firstBraceIndex === -1 || lastBraceIndex === -1) {
      throw new Error("No se pudo interpretar la respuesta JSON del chat.");
    }

    return JSON.parse(
      trimmedContent.slice(firstBraceIndex, lastBraceIndex + 1),
    ) as unknown;
  }
}

function buildStatusBreakdown(quotations: Quotation[]) {
  return quotations.reduce<Record<string, number>>((counts, quotation) => {
    const status = getTrimmedString(quotation.status) ?? "sin_estado";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function getReferenceDate(referenceDate = new Date()) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
}

function parseQuotationCreatedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function resolveQuotationPeriodFilter(
  prompt: string,
): QuotationPeriodFilter | null {
  const normalizedPrompt = prompt.trim().toLowerCase();

  if (!normalizedPrompt) {
    return null;
  }

  if (/(hoy|de hoy|del día|del dia)/.test(normalizedPrompt)) {
    return "day";
  }

  if (/(esta semana|de la semana|semana actual)/.test(normalizedPrompt)) {
    return "week";
  }

  if (/(este mes|del mes|mes actual)/.test(normalizedPrompt)) {
    return "month";
  }

  return null;
}

function parseExpenseDate(value: string) {
  const parsedDate = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function filterExpensesByPeriod(
  expenses: Expense[],
  period: QuotationPeriodFilter,
  referenceDate = new Date(),
) {
  const today = getReferenceDate(referenceDate);

  return expenses.filter((expense) => {
    const expenseDay = parseExpenseDate(expense.date);

    if (!expenseDay) {
      return false;
    }

    const scopedDay = getReferenceDate(expenseDay);

    if (period === "day") {
      return scopedDay.getTime() === today.getTime();
    }

    if (period === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return (
        scopedDay.getTime() >= weekStart.getTime() &&
        scopedDay.getTime() <= weekEnd.getTime()
      );
    }

    return (
      scopedDay.getFullYear() === today.getFullYear() &&
      scopedDay.getMonth() === today.getMonth()
    );
  });
}

export function resolveExpensePeriodFilter(prompt: string) {
  return resolveQuotationPeriodFilter(prompt);
}

export function shouldLoadExpenseDetails(prompt: string) {
  const normalizedPrompt = prompt.trim().toLowerCase();

  if (!normalizedPrompt) {
    return false;
  }

  return /(gasto|gastos|egreso|egresos|ganancia neta|gané neto|gane neto|margen|cuánto gasté|cuanto gaste|mayor gasto|último gasto|ultimo gasto|por categor[ií]a|neto este mes|cuánto gané|cuanto gane)/i.test(
    normalizedPrompt,
  );
}

function toExpenseLine(expense: Expense): BusinessChatExpenseLine {
  return {
    id: expense.id,
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
  };
}

function buildTotalsByCategory(expenses: Expense[]) {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    const category = normalizeExpenseCategory(expense.category);
    totals.set(category, (totals.get(category) ?? 0) + expense.amount);
  }

  return Array.from(totals.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((left, right) => right.total - left.total);
}

function buildTotalsByCurrency(expenses: Expense[]): ExpenseCurrencyTotal[] {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    totals.set(
      expense.currency,
      (totals.get(expense.currency) ?? 0) + expense.amount,
    );
  }

  return Array.from(totals.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

function getAcceptedQuotedTotal(
  quotations: Quotation[],
  period: QuotationPeriodFilter,
  referenceDate = new Date(),
) {
  return filterQuotationsByPeriod(quotations, period, referenceDate)
    .filter((quotation) => {
      const status = getTrimmedString(quotation.status)?.toLowerCase() ?? "";
      return status === "accepted" || status === "approved";
    })
    .reduce((sum, quotation) => sum + (quotation.total ?? 0), 0);
}

export function buildBusinessChatExpenseSnapshot({
  expenses,
  quotations,
  profile,
  period = "month",
  referenceDate = new Date(),
}: {
  expenses: Expense[];
  quotations: Quotation[];
  profile: Profile | null;
  period?: QuotationPeriodFilter | "month";
  referenceDate?: Date;
}): BusinessChatExpenseSnapshot {
  const scopedPeriod: QuotationPeriodFilter =
    period === "month" ? "month" : period;
  const scopedExpenses = filterExpensesByPeriod(
    expenses,
    scopedPeriod,
    referenceDate,
  );
  const totalsByCurrency = buildTotalsByCurrency(scopedExpenses);
  const totalsByCategory = buildTotalsByCategory(scopedExpenses);
  const sortedByAmount = [...scopedExpenses].sort(
    (left, right) => right.amount - left.amount,
  );
  const sortedByDate = [...scopedExpenses].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
  const acceptedQuotedTotal = getAcceptedQuotedTotal(
    quotations,
    scopedPeriod,
    referenceDate,
  );
  const profileCurrency = getTrimmedString(profile?.currency ?? null);
  const canCalculateNetProfit =
    scopedExpenses.length > 0 &&
    totalsByCurrency.length === 1 &&
    totalsByCurrency[0]?.currency === profileCurrency;
  const expenseTotal = totalsByCurrency[0]?.total ?? 0;

  return {
    period: scopedPeriod,
    expenseCount: scopedExpenses.length,
    totalsByCurrency,
    totalsByCategory,
    latestExpense: sortedByDate[0] ? toExpenseLine(sortedByDate[0]) : null,
    largestExpense: sortedByAmount[0] ? toExpenseLine(sortedByAmount[0]) : null,
    recentExpenses: sortedByDate
      .slice(0, MAX_CONTEXT_EXPENSES)
      .map((expense) => toExpenseLine(expense)),
    profitability: {
      acceptedQuotedTotal,
      netProfit: canCalculateNetProfit
        ? acceptedQuotedTotal - expenseTotal
        : null,
      netProfitCurrency: canCalculateNetProfit ? profileCurrency : null,
      canCalculateNetProfit,
      note: !scopedExpenses.length
        ? "Sin gastos registrados en el período consultado."
        : totalsByCurrency.length > 1
          ? "Hay gastos en varias monedas; la ganancia neta solo se calcula con una moneda."
          : profileCurrency && totalsByCurrency[0]?.currency !== profileCurrency
            ? `Los gastos están en ${totalsByCurrency[0]?.currency} y el perfil usa ${profileCurrency}.`
            : null,
    },
  };
}

export async function loadBusinessChatExpenseContext(
  userId: string,
  options?: {
    periodFilter?: QuotationPeriodFilter | null;
    quotations?: Quotation[];
    profile?: Profile | null;
    referenceDate?: Date;
  },
): Promise<BusinessChatExpenseSnapshot> {
  const referenceDate = options?.referenceDate ?? new Date();
  const period = options?.periodFilter ?? "month";
  const { getExpenses } = await import("@/lib/expenses");
  const expenses = await getExpenses(userId);

  return buildBusinessChatExpenseSnapshot({
    expenses,
    quotations: options?.quotations ?? [],
    profile: options?.profile ?? null,
    period,
    referenceDate,
  });
}

export function filterQuotationsByPeriod(
  quotations: Quotation[],
  period: QuotationPeriodFilter,
  referenceDate = new Date(),
) {
  const today = getReferenceDate(referenceDate);

  return quotations.filter((quotation) => {
    const createdAt = parseQuotationCreatedAt(quotation.created_at);

    if (!createdAt) {
      return false;
    }

    const createdDay = getReferenceDate(createdAt);

    if (period === "day") {
      return createdDay.getTime() === today.getTime();
    }

    if (period === "week") {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      return (
        createdDay.getTime() >= weekStart.getTime() &&
        createdDay.getTime() <= weekEnd.getTime()
      );
    }

    return (
      createdDay.getFullYear() === today.getFullYear() &&
      createdDay.getMonth() === today.getMonth()
    );
  });
}

function normalizeSuggestedQuotationItem(
  input: unknown,
  catalogIds: Set<string>,
): ChatSuggestedQuotationItem | null {
  if (!isRecord(input)) {
    return null;
  }

  const name = getTrimmedString(input.name);
  const quantity = parseDecimal(input.quantity);
  const unitPrice = parseDecimal(input.unitPrice ?? input.price);

  if (!name || quantity === null || quantity <= 0 || unitPrice === null || unitPrice < 0) {
    return null;
  }

  const rawCatalogItemId = getTrimmedString(input.catalogItemId);

  return {
    catalogItemId:
      rawCatalogItemId && catalogIds.has(rawCatalogItemId) ? rawCatalogItemId : null,
    name,
    description: getTrimmedString(input.description),
    quantity,
    unit: normalizeCatalogUnit(getTrimmedString(input.unit)),
    unitPrice,
  };
}

function normalizeSuggestedAction(
  input: unknown,
  references: BusinessChatReferences,
): ChatSuggestedAction | null {
  if (!isRecord(input)) {
    return null;
  }

  const type = getTrimmedString(input.type);
  const catalogById = new Map(references.catalogItems.map((item) => [item.id, item]));
  const catalogIds = new Set(catalogById.keys());
  const clientById = new Map(references.clients.map((client) => [client.id, client]));

  if (type === "catalog_price_update") {
    const itemId = getTrimmedString(input.itemId);

    if (!itemId) {
      return null;
    }

    const catalogItem = catalogById.get(itemId);
    const suggestedPrice = parseDecimal(input.suggestedPrice);

    if (!catalogItem || suggestedPrice === null || suggestedPrice < 0) {
      return null;
    }

    return {
      type,
      itemId,
      itemName: catalogItem.name,
      currentPrice: catalogItem.price,
      suggestedPrice,
      reason: getTrimmedString(input.reason),
    };
  }

  if (type === "draft_quotation_create") {
    const rawItems = Array.isArray(input.items) ? input.items : [];
    const items = rawItems
      .map((item) => normalizeSuggestedQuotationItem(item, catalogIds))
      .filter((item): item is ChatSuggestedQuotationItem => item !== null);

    if (items.length === 0) {
      return null;
    }

    const clientId = getTrimmedString(input.clientId);
    const matchedClient = clientId ? clientById.get(clientId) ?? null : null;

    if (!matchedClient) {
      return null;
    }

    return {
      type,
      clientId: matchedClient.id,
      clientName: matchedClient.name,
      clientSource: "existing",
      notes: getTrimmedString(input.notes),
      items,
    };
  }

  if (type === "expense_create") {
    const description = getTrimmedString(input.description);
    const amount = parseDecimal(input.amount);
    const currency = getTrimmedString(input.currency) ?? "ARS";
    const category = normalizeExpenseCategory(getTrimmedString(input.category) ?? "Otro");
    const date = getTrimmedString(input.date) ?? new Date().toISOString().slice(0, 10);
    const notes = getTrimmedString(input.notes);

    if (!description || amount === null || amount <= 0) {
      return null;
    }

    const suggestion: ChatExpenseCreateAction = {
      type,
      description,
      amount,
      currency,
      category,
      date,
      notes,
    };

    return suggestion;
  }

  return null;
}

function formatHistoryMessages(messages: ChatConversationMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function getChatModel() {
  return process.env.OPENAI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

function createChatHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

export async function readChatRequestBody(
  request: Pick<Request, "json">,
): Promise<ChatRequestBody> {
  try {
    return (await request.json()) as ChatRequestBody;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw createChatHttpError(400, "El cuerpo JSON del chat es inválido.");
    }

    throw error;
  }
}

export function buildBusinessChatSystemPrompt() {
  return [
    "Eres el asistente comercial de Cotizapp.",
    "Responde siempre en español rioplatense, tono directo y simple.",
    "Trabaja solo dentro de este alcance: clientes, catálogo, cotizaciones, gastos y perfil/resumen del negocio.",
    "Tenés herramientas reales: getClientesList (availableClients en contexto) y createCotizacion (solo tras confirmación del usuario).",
    "Usa expenses del contexto para responder cuánto gastó el usuario, el mayor gasto, el último gasto y la ganancia neta del período.",
    "Usa meta.currentDate como fecha de referencia para interpretar hoy, esta semana y este mes.",
    "Si meta.quotationPeriodFilter viene informado, responde usando solo recentQuotations, summary.filteredQuotations y expenses del mismo período.",
    "FLUJO OBLIGATORIO PARA COTIZACIONES:",
    "1) Si el usuario pide crear una cotización y todavía no eligió cliente, listá TODOS los availableClients numerados (id, nombre, teléfono) en reply y suggestedAction=null.",
    "2) NUNCA inventes un cliente nuevo ni uses clientSource inline.",
    "3) Solo después de que el usuario elija un cliente existente (por nombre, número de lista o id), podés proponer draft_quotation_create con clientId válido de availableClients.",
    "4) El preview va en reply; suggestedAction solo cuando haya clientId + ítems válidos.",
    "5) Nunca escribas en la base sin confirmación explícita del usuario (responde «sí», «dale», etc.).",
    "6) NUNCA digas que ya guardaste o creaste una cotización en reply. Solo podés decir que quedó lista PARA CONFIRMAR.",
    "Si te piden registrar un gasto, devolvé preview claro en reply y suggestedAction con expense_create.",
    "Regla de conversación: si falta info de ítems, pedí todo en UNA sola pregunta.",
    "No preguntes lo que se puede asumir: fecha = hoy y moneda = la del perfil.",
    "Si el usuario pregunta por resumen, respondé con métricas concretas del mes usando summary y expenses.",
    "Si el pedido cae fuera de alcance, rechazalo y redirige a módulos de negocio.",
    "Si no hace falta proponer una acción, devuelve suggestedAction como null.",
    "Las acciones permitidas son draft_quotation_create, expense_create y catalog_price_update.",
    "Cuando propongas guardar, cerrá reply con: ¿Confirmo y lo guardo?",
  ].join(" ");
}

export function buildBusinessChatContext({
  profile,
  clients,
  availableClients,
  catalogItems,
  quotations,
  expenses = null,
  quotationPeriodFilter = null,
  referenceDate = new Date(),
}: BusinessChatContextInput & {
  quotationPeriodFilter?: QuotationPeriodFilter | null;
  referenceDate?: Date;
}): BusinessChatContext {
  const scopedQuotations = quotationPeriodFilter
    ? filterQuotationsByPeriod(quotations, quotationPeriodFilter, referenceDate)
    : quotations;
  const expenseSnapshot =
    expenses ??
    buildBusinessChatExpenseSnapshot({
      expenses: [],
      quotations,
      profile,
      period: quotationPeriodFilter ?? "month",
      referenceDate,
    });

  return {
    meta: {
      currentDate: referenceDate.toISOString().slice(0, 10),
      timezone: "America/Argentina/Mendoza",
      quotationPeriodFilter,
    },
    business: {
      businessName: getTrimmedString(profile?.business_name ?? null),
      industry: getTrimmedString(profile?.industry ?? null),
      currency: getTrimmedString(profile?.currency ?? null),
      contactEmail: getTrimmedString(profile?.email ?? null),
    },
    summary: {
      totalClients: clients.length,
      totalCatalogItems: catalogItems.length,
      totalQuotations: quotations.length,
      filteredQuotations: scopedQuotations.length,
      quotationStatusBreakdown: buildStatusBreakdown(scopedQuotations),
    },
    recentClients: clients.slice(0, 8).map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    })),
    availableClients,
    recentCatalogItems: catalogItems
      .slice(0, MAX_CONTEXT_CATALOG_ITEMS)
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: normalizeCatalogUnit(item.unit),
        price: item.price,
      })),
    recentQuotations: scopedQuotations
      .slice(0, MAX_CONTEXT_QUOTATIONS)
      .map((quotation) => ({
        id: quotation.id,
        number: quotation.number,
        status: quotation.status,
        clientName: quotation.client_name,
        total: quotation.total ?? 0,
        validUntil: quotation.valid_until,
        createdAt: quotation.created_at,
        notes: truncateText(getTrimmedString(quotation.notes), MAX_NOTES_LENGTH),
      })),
    expenses: expenseSnapshot,
  };
}

export function normalizeBusinessChatResult(
  input: unknown,
  references: BusinessChatReferences,
): ChatReplyPayload {
  const source = isRecord(input) ? input : {};
  const suggestedAction = normalizeSuggestedAction(source.suggestedAction, references);
  const rawReply =
    getTrimmedString(source.reply) ??
    "No pude generar una respuesta útil en este momento. Intenta reformular tu consulta.";

  return {
    reply: sanitizeChatReply(rawReply, suggestedAction),
    suggestedAction,
  };
}

export async function runBusinessChat(
  prompt: string,
  context: BusinessChatContext,
  references: BusinessChatReferences,
  options?: {
    history?: ChatConversationMessage[];
  },
): Promise<ChatReplyPayload> {
  const apiKey = getOpenAIApiKey();

  if (!apiKey) {
    throw new Error("Falta configurar OPENAI_API_KEY para usar el chat con AI.");
  }

  const client = getOpenAIClient();
  const model = getChatModel();
  const history = (options?.history ?? []).slice(-MAX_HISTORY_MESSAGES);
  const completion = await client.chat.completions.create({
    model,
    response_format: {
      type: "json_object",
    },
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: buildBusinessChatSystemPrompt(),
      },
      {
        role: "system",
        content: `Contexto acotado del negocio:\n${JSON.stringify(context)}`,
      },
      ...formatHistoryMessages(history),
      {
        role: "user",
        content: `${prompt}\n\nDevuelve solo JSON con esta forma exacta: {"reply":"string","suggestedAction":null|{...}}. reply debe estar en español.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJsonObjectFromText(content);
  const result = normalizeBusinessChatResult(parsed, references);

  if (
    isQuotationCreateIntent(prompt) &&
    !result.suggestedAction &&
    context.availableClients.length > 0 &&
    !result.reply.includes("¿Para cuál cliente")
  ) {
    return {
      reply: formatClientesListForChatReply(context.availableClients),
      suggestedAction: null,
    };
  }

  return result;
}
