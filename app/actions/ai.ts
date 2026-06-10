"use server";

import { revalidatePath } from "next/cache";

import { assertCatalogPriceSuggestionIsCurrent } from "@/lib/ai/catalog-price-updates";
import { createCotizacion } from "@/lib/chat/chat-tools";
import { normalizeCatalogUnit } from "@/lib/catalog";
import { normalizeExpenseCategory, normalizeExpenseDateInput } from "@/lib/expenses";
import { requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type {
  ChatCatalogPriceUpdateAction,
  ChatDraftQuotationCreateAction,
  ChatExpenseCreateAction,
  ChatSuggestedQuotationItem,
} from "@/types";

type CatalogItemRecord = {
  id: string;
  name: string;
  price: number | string | null;
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

function normalizeSuggestedItem(input: unknown): ChatSuggestedQuotationItem | null {
  if (!isRecord(input)) {
    return null;
  }

  const name = getTrimmedString(input.name);
  const quantity = parseDecimal(input.quantity);
  const unitPrice = parseDecimal(input.unitPrice);

  if (!name || quantity === null || quantity <= 0 || unitPrice === null || unitPrice < 0) {
    return null;
  }

  return {
    catalogItemId: getTrimmedString(input.catalogItemId),
    name,
    description: getTrimmedString(input.description),
    quantity,
    unit: normalizeCatalogUnit(getTrimmedString(input.unit)),
    unitPrice,
  };
}

function normalizeDraftQuotationSuggestion(
  input: unknown,
): ChatDraftQuotationCreateAction {
  if (!isRecord(input) || input.type !== "draft_quotation_create") {
    throw new Error("La sugerencia de cotización no es válida.");
  }

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items = rawItems
    .map((item) => normalizeSuggestedItem(item))
    .filter((item): item is ChatSuggestedQuotationItem => item !== null);

  if (items.length === 0) {
    throw new Error("La sugerencia no incluye ítems válidos para crear un borrador.");
  }

  const clientId = getTrimmedString(input.clientId);
  const clientName = getTrimmedString(input.clientName);
  const clientSource =
    input.clientSource === "existing" || input.clientSource === "inline"
      ? input.clientSource
      : null;

  if (!clientSource) {
    throw new Error("La sugerencia no indica como se resolvera el cliente.");
  }

  if (clientSource === "existing") {
    if (!clientId) {
      throw new Error("La sugerencia no incluye un cliente existente válido.");
    }

    return {
      type: "draft_quotation_create",
      clientId,
      clientName,
      clientSource,
      notes: getTrimmedString(input.notes),
      items,
    };
  }

  throw new Error(
    "La cotización del chat debe usar un cliente existente. Elegí uno de tu lista de clientes.",
  );
}

function normalizeCatalogPriceSuggestion(
  input: unknown,
): ChatCatalogPriceUpdateAction {
  if (!isRecord(input) || input.type !== "catalog_price_update") {
    throw new Error("La sugerencia de precio no es válida.");
  }

  const itemId = getTrimmedString(input.itemId);
  const suggestedPrice = parseDecimal(input.suggestedPrice);

  if (!itemId || suggestedPrice === null || suggestedPrice < 0) {
    throw new Error("La sugerencia de precio no es válida.");
  }

  return {
    type: "catalog_price_update",
    itemId,
    itemName: getTrimmedString(input.itemName) ?? "Ítem del catálogo",
    currentPrice: parseDecimal(input.currentPrice) ?? 0,
    suggestedPrice,
    reason: getTrimmedString(input.reason),
  };
}

function normalizeExpenseCreateSuggestion(input: unknown): ChatExpenseCreateAction {
  if (!isRecord(input) || input.type !== "expense_create") {
    throw new Error("La sugerencia de gasto no es válida.");
  }

  const description = getTrimmedString(input.description);
  const amount = parseDecimal(input.amount);
  const currency = getTrimmedString(input.currency) ?? "ARS";
  const category = normalizeExpenseCategory(getTrimmedString(input.category) ?? "Otro");
  const date = normalizeExpenseDateInput(getTrimmedString(input.date) ?? null);
  const notes = getTrimmedString(input.notes);

  if (!description) {
    throw new Error("La sugerencia no incluye una descripción válida.");
  }

  if (amount === null || amount <= 0) {
    throw new Error("La sugerencia no incluye un monto válido.");
  }

  return {
    type: "expense_create",
    description,
    amount,
    currency,
    category,
    date,
    notes,
  };
}

function revalidateAiViews() {
  revalidatePath("/chat");
  revalidatePath("/catalogo");
  revalidatePath("/cotizaciones");
  revalidatePath("/cotizaciones/nueva");
  revalidatePath("/dashboard");
}

export async function getClientesListAction() {
  const user = await requireUser();
  const { getClientesList } = await import("@/lib/chat/chat-tools");
  return getClientesList(user.id);
}

export async function confirmCatalogPriceUpdateAction(input: unknown) {
  const user = await requireUser();
  const suggestion = normalizeCatalogPriceSuggestion(input);
  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("catalog_items")
    .select("id, name, price")
    .eq("id", suggestion.itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (itemError) {
    throw new Error("No se pudo validar el ítem del catálogo sugerido.");
  }

  const currentItem = (item as CatalogItemRecord | null) ?? null;

  if (!currentItem) {
    throw new Error("El item sugerido no existe o no te pertenece.");
  }

  const previousPrice = parseDecimal(currentItem.price) ?? 0;
  assertCatalogPriceSuggestionIsCurrent({
    itemName: currentItem.name,
    currentPrice: previousPrice,
    suggestedCurrentPrice: suggestion.currentPrice,
  });
  const { data, error } = await supabase
    .from("catalog_items")
    .update({
      price: suggestion.suggestedPrice,
    })
    .eq("id", suggestion.itemId)
    .eq("user_id", user.id)
    .select("id, name, price")
    .maybeSingle();

  if (error) {
    throw new Error("No se pudo actualizar el precio del catálogo.");
  }

  const updatedItem = (data as CatalogItemRecord | null) ?? null;

  if (!updatedItem) {
    throw new Error("El item sugerido no existe o no te pertenece.");
  }

  revalidateAiViews();

  return {
    itemId: updatedItem.id,
    itemName: updatedItem.name,
    previousPrice,
    updatedPrice: parseDecimal(updatedItem.price) ?? suggestion.suggestedPrice,
  };
}

export async function confirmDraftQuotationSuggestionAction(input: unknown) {
  const user = await requireUser();
  const suggestion = normalizeDraftQuotationSuggestion(input);

  if (suggestion.clientSource !== "existing" || !suggestion.clientId) {
    throw new Error(
      "Elegí un cliente existente antes de guardar la cotización.",
    );
  }

  const result = await createCotizacion(user.id, {
    cliente_id: suggestion.clientId,
    items: suggestion.items.map((item) => ({
      concepto: item.name,
      cantidad: item.quantity,
      precio_unitario: item.unitPrice,
      catalog_item_id: item.catalogItemId,
      descripcion: item.description,
      unidad: item.unit,
    })),
    notas: suggestion.notes,
  });

  revalidateAiViews();

  return {
    quotationId: result.id,
    number: result.number,
  };
}

export async function confirmExpenseCreateSuggestionAction(input: unknown) {
  const user = await requireUser();
  const suggestion = normalizeExpenseCreateSuggestion(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      description: suggestion.description,
      amount: suggestion.amount,
      currency: suggestion.currency,
      category: suggestion.category,
      date: suggestion.date,
      notes: suggestion.notes,
    })
    .select("id, description, amount, currency, category, date")
    .single();

  if (error || !data) {
    throw new Error("No se pudo guardar el gasto sugerido.");
  }

  revalidateAiViews();
  revalidatePath("/gastos");

  return {
    expenseId: String(data.id),
    description: String(data.description),
    amount: parseDecimal(data.amount) ?? suggestion.amount,
    currency: String(data.currency),
    category: String(data.category),
    date: String(data.date),
  };
}
