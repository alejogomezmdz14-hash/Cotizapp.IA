"use server";

import { revalidatePath } from "next/cache";

import { reserveNextQuotationNumber } from "@/app/actions/quotation-number";
import { assertCatalogPriceSuggestionIsCurrent } from "@/lib/ai/catalog-price-updates";
import { normalizeCatalogUnit } from "@/lib/catalog";
import { normalizeExpenseCategory, normalizeExpenseDateInput } from "@/lib/expenses";
import { requireUser } from "@/lib/profile";
import { calculateQuotationTotals } from "@/lib/quotation-calculations";
import {
  assertSingleQuotationRollbackMutation,
  buildQuotationItemInsertRows,
  DRAFT_QUOTATION_STATUS,
  persistDraftQuotation,
} from "@/lib/quotations";
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

type ClientRecord = {
  id: string;
  name: string;
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

  if (clientId) {
    throw new Error("La sugerencia inline no puede incluir un cliente existente.");
  }

  if (!clientName) {
    throw new Error("La sugerencia no incluye un cliente válido.");
  }

  return {
    type: "draft_quotation_create",
    clientId: null,
    clientName,
    clientSource,
    notes: getTrimmedString(input.notes),
    items,
  };
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
  const supabase = await createClient();
  const requestedCatalogIds = suggestion.items.flatMap((item) =>
    item.catalogItemId ? [item.catalogItemId] : [],
  );
  const catalogIdSet = new Set<string>();

  if (requestedCatalogIds.length > 0) {
    const { data: catalogRows, error: catalogError } = await supabase
      .from("catalog_items")
      .select("id")
      .eq("user_id", user.id)
      .in("id", requestedCatalogIds);

    if (catalogError) {
      throw new Error("No se pudieron validar los ítems sugeridos del catálogo.");
    }

    for (const row of (catalogRows ?? []) as Array<{ id: string }>) {
      catalogIdSet.add(row.id);
    }
  }

  const items = suggestion.items.map((item) => ({
    catalogItemId:
      item.catalogItemId && catalogIdSet.has(item.catalogItemId)
        ? item.catalogItemId
        : null,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit: normalizeCatalogUnit(item.unit),
    unitPrice: item.unitPrice,
  }));
  const totals = calculateQuotationTotals(items, 0);
  const result = await persistDraftQuotation(
    {
      createInlineClient: async (inlineClient) => {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            user_id: user.id,
            ...inlineClient,
          })
          .select("id, name")
          .single();

        if (error || !data) {
          throw new Error("No se pudo crear el cliente para el borrador sugerido.");
        }

        return data as ClientRecord;
      },
      getExistingClient: async (clientId) => {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name")
          .eq("id", clientId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw new Error("No se pudo validar el cliente de la sugerencia.");
        }

        return (data as ClientRecord | null) ?? null;
      },
      createQuotation: async ({
        clientId,
        clientName,
        quotationNumber,
        notes,
        subtotal,
        taxRate,
        total,
        validUntil,
      }) => {
        const { data, error } = await supabase
          .from("quotations")
          .insert({
            user_id: user.id,
            client_id: clientId,
            client_name: clientName,
            number: quotationNumber,
            status: DRAFT_QUOTATION_STATUS,
            notes,
            subtotal,
            tax_rate: taxRate,
            total,
            valid_until: validUntil,
          })
          .select("id, number")
          .single();

        if (error || !data) {
          throw new Error("No se pudo guardar el borrador sugerido.");
        }

        return data as { id: string; number: string };
      },
      createQuotationItems: async (quotationId, quotationItems) => {
        const { error } = await supabase
          .from("quotation_items")
          .insert(buildQuotationItemInsertRows(quotationId, quotationItems));

        if (error) {
          throw new Error("No se pudieron guardar los items del borrador sugerido.");
        }
      },
      deleteQuotation: async (quotationId) => {
        const { data, error } = await supabase
          .from("quotations")
          .delete()
          .eq("id", quotationId)
          .eq("user_id", user.id)
          .select("id");

        if (error) {
          throw new Error("No se pudo revertir el borrador sugerido.");
        }

        assertSingleQuotationRollbackMutation(data, "quotation");
      },
      deleteClient: async (clientId) => {
        const { data, error } = await supabase
          .from("clients")
          .delete()
          .eq("id", clientId)
          .eq("user_id", user.id)
          .select("id");

        if (error) {
          throw new Error("No se pudo eliminar el cliente temporal sugerido.");
        }

        assertSingleQuotationRollbackMutation(data, "client");
      },
    },
    {
      values: {
        clientId: suggestion.clientId,
        inlineClient: suggestion.clientId
          ? null
          : {
              name: suggestion.clientName ?? "Cliente sugerido",
              email: null,
              phone: null,
              address: null,
            },
        notes: suggestion.notes,
        taxRate: 0,
        validUntil: null,
        items,
      },
      quotationNumber: await reserveNextQuotationNumber(),
      subtotal: totals.subtotal,
      total: totals.total,
    },
  );

  revalidateAiViews();

  return result;
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
