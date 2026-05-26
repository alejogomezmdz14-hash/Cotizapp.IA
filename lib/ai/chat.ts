import { normalizeCatalogUnit } from "@/lib/catalog";
import { getOpenAIClient } from "@/lib/ai/openai";
import type {
  CatalogItem,
  ChatConversationMessage,
  ChatReplyPayload,
  ChatSuggestedAction,
  ChatSuggestedQuotationItem,
  Client,
  Profile,
  Quotation,
} from "@/types";

const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const MAX_CONTEXT_CLIENTS = 6;
const MAX_CONTEXT_CATALOG_ITEMS = 8;
const MAX_CONTEXT_QUOTATIONS = 6;
const MAX_HISTORY_MESSAGES = 8;
const MAX_NOTES_LENGTH = 96;

type BusinessChatContextInput = {
  profile: Profile | null;
  clients: Client[];
  catalogItems: CatalogItem[];
  quotations: Quotation[];
};

type BusinessChatReferences = {
  clients: Client[];
  catalogItems: CatalogItem[];
};

type ChatRequestBody = {
  messages?: unknown;
};

export type BusinessChatContext = {
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
    quotationStatusBreakdown: Record<string, number>;
  };
  recentClients: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
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
    notes: string | null;
  }>;
};

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
    const clientName =
      getTrimmedString(input.clientName) ?? matchedClient?.name ?? null;

    if (!clientName && !matchedClient) {
      return null;
    }

    return {
      type,
      clientId: matchedClient?.id ?? null,
      clientName: matchedClient?.name ?? clientName,
      clientSource: matchedClient ? "existing" : "inline",
      notes: getTrimmedString(input.notes),
      items,
    };
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
      throw createChatHttpError(400, "El cuerpo JSON del chat es invalido.");
    }

    throw error;
  }
}

export function buildBusinessChatSystemPrompt() {
  return [
    "Eres el asistente comercial de Cotizapp.",
    "Responde siempre en espanol rioplatense claro.",
    "Trabaja solo dentro de este alcance: clientes, catalogo, cotizaciones y perfil/resumen del negocio.",
    "Si el pedido cae fuera de ese alcance, rechaza la parte fuera de alcance, indica claramente que esta fuera de alcance y redirige la conversacion a esos modulos de negocio; no actues como asistente general.",
    "Nunca afirmes que ya creaste, actualizaste o eliminaste datos.",
    "Solo puedes sugerir acciones de escritura para confirmacion explicita del usuario.",
    "Si no hace falta proponer una accion, devuelve suggestedAction como null.",
    "Las unicas acciones permitidas son draft_quotation_create y catalog_price_update.",
  ].join(" ");
}

export function buildBusinessChatContext({
  profile,
  clients,
  catalogItems,
  quotations,
}: BusinessChatContextInput): BusinessChatContext {
  return {
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
      quotationStatusBreakdown: buildStatusBreakdown(quotations),
    },
    recentClients: clients.slice(0, MAX_CONTEXT_CLIENTS).map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
    })),
    recentCatalogItems: catalogItems
      .slice(0, MAX_CONTEXT_CATALOG_ITEMS)
      .map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: normalizeCatalogUnit(item.unit),
        price: item.price,
      })),
    recentQuotations: quotations.slice(0, MAX_CONTEXT_QUOTATIONS).map((quotation) => ({
      id: quotation.id,
      number: quotation.number,
      status: quotation.status,
      clientName: quotation.client_name,
      total: quotation.total ?? 0,
      validUntil: quotation.valid_until,
      notes: truncateText(getTrimmedString(quotation.notes), MAX_NOTES_LENGTH),
    })),
  };
}

export function normalizeBusinessChatResult(
  input: unknown,
  references: BusinessChatReferences,
): ChatReplyPayload {
  const source = isRecord(input) ? input : {};

  return {
    reply:
      getTrimmedString(source.reply) ??
      "No pude generar una respuesta util en este momento. Intenta reformular tu consulta.",
    suggestedAction: normalizeSuggestedAction(source.suggestedAction, references),
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();

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
        content: `${prompt}\n\nDevuelve solo JSON con esta forma exacta: {"reply":"string","suggestedAction":null|{...}}. reply debe estar en espanol.`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJsonObjectFromText(content);

  return normalizeBusinessChatResult(parsed, references);
}
