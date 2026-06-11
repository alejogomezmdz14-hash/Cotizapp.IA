import { reserveNextQuotationNumber } from "@/app/actions/quotation-number";
import type { ChatClientListItem } from "@/types";
import { normalizeCatalogUnit } from "@/lib/catalog";
import { getClients } from "@/lib/clients";
import { calculateQuotationTotals } from "@/lib/quotation-calculations";
import {
  assertSingleQuotationRollbackMutation,
  buildQuotationItemInsertRows,
  DRAFT_QUOTATION_STATUS,
  persistDraftQuotation,
} from "@/lib/quotations";
import { createClient } from "@/lib/supabase/server";

export type { ChatClientListItem } from "@/types";
export {
  buildClientSelectorReply,
  formatClientesListForChatReply,
} from "@/lib/chat/client-list-format";

export type CreateCotizacionItemInput = {
  concepto: string;
  cantidad: number;
  precio_unitario: number;
  catalog_item_id?: string | null;
  descripcion?: string | null;
  unidad?: string | null;
};

export type CreateCotizacionInput = {
  cliente_id: string;
  items: CreateCotizacionItemInput[];
  notas?: string | null;
  descuento?: number | null;
};

type ClientRecord = {
  id: string;
  name: string;
};

const MAX_CHAT_CLIENTS = 100;

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

  const normalizedValue = compactValue.replace(",", ".");
  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeCreateCotizacionInput(input: CreateCotizacionInput) {
  const clienteId = input.cliente_id?.trim();

  if (!clienteId) {
    throw new Error("Falta indicar el cliente de la cotización.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("La cotización debe incluir al menos un ítem.");
  }

  const items = input.items
    .map((item) => {
      const concepto = item.concepto?.trim();
      const cantidad = parseDecimal(item.cantidad);
      const precioUnitario = parseDecimal(item.precio_unitario);

      if (
        !concepto ||
        cantidad === null ||
        cantidad <= 0 ||
        precioUnitario === null ||
        precioUnitario < 0
      ) {
        return null;
      }

      return {
        catalogItemId: item.catalog_item_id?.trim() || null,
        name: concepto,
        description: item.descripcion?.trim() || null,
        quantity: cantidad,
        unit: normalizeCatalogUnit(item.unidad),
        unitPrice: precioUnitario,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) {
    throw new Error("Ningún ítem de la cotización es válido.");
  }

  const descuento = parseDecimal(input.descuento ?? null);
  const taxRate =
    descuento !== null && descuento >= 0 && descuento <= 100 ? descuento : 0;

  return {
    clienteId,
    items,
    notas: input.notas?.trim() || null,
    taxRate,
  };
}

/** Lista clientes del usuario para el flujo de cotización del chat. */
export async function getClientesList(userId: string): Promise<ChatClientListItem[]> {
  const clients = await getClients(userId);

  return clients.slice(0, MAX_CHAT_CLIENTS).map((client) => ({
    id: client.id,
    nombre: client.name,
    email: client.email,
    telefono: client.phone,
  }));
}

/** Crea una cotización borrador en la DB (solo tras confirmación del usuario). */
export async function createCotizacion(userId: string, input: CreateCotizacionInput) {
  const normalized = normalizeCreateCotizacionInput(input);
  const supabase = await createClient();
  const requestedCatalogIds = normalized.items.flatMap((item) =>
    item.catalogItemId ? [item.catalogItemId] : [],
  );
  const catalogIdSet = new Set<string>();

  if (requestedCatalogIds.length > 0) {
    const { data: catalogRows, error: catalogError } = await supabase
      .from("catalog_items")
      .select("id")
      .eq("user_id", userId)
      .in("id", requestedCatalogIds);

    if (catalogError) {
      throw new Error("No se pudieron validar los ítems del catálogo.");
    }

    for (const row of (catalogRows ?? []) as Array<{ id: string }>) {
      catalogIdSet.add(row.id);
    }
  }

  const items = normalized.items.map((item) => ({
    catalogItemId:
      item.catalogItemId && catalogIdSet.has(item.catalogItemId)
        ? item.catalogItemId
        : null,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
  }));
  const totals = calculateQuotationTotals(items, normalized.taxRate);

  const result = await persistDraftQuotation(
    {
      createInlineClient: async () => {
        throw new Error(
          "El chat no puede crear clientes nuevos. Elegí un cliente existente.",
        );
      },
      getExistingClient: async (clientId) => {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name")
          .eq("id", clientId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          throw new Error("No se pudo validar el cliente de la cotización.");
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
            user_id: userId,
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
          throw new Error("No se pudo guardar la cotización borrador.");
        }

        return data as { id: string; number: string };
      },
      createQuotationItems: async (quotationId, quotationItems) => {
        const { error } = await supabase
          .from("quotation_items")
          .insert(buildQuotationItemInsertRows(quotationId, quotationItems));

        if (error) {
          throw new Error("No se pudieron guardar los ítems de la cotización.");
        }
      },
      deleteQuotation: async (quotationId) => {
        const { data, error } = await supabase
          .from("quotations")
          .delete()
          .eq("id", quotationId)
          .eq("user_id", userId)
          .select("id");

        if (error) {
          throw new Error("No se pudo revertir la cotización.");
        }

        assertSingleQuotationRollbackMutation(data, "quotation");
      },
      deleteClient: async () => {
        throw new Error("El chat no elimina clientes durante la creación de cotizaciones.");
      },
    },
    {
      values: {
        clientId: normalized.clienteId,
        inlineClient: null,
        notes: normalized.notas,
        taxRate: normalized.taxRate,
        validUntil: null,
        items,
      },
      quotationNumber: await reserveNextQuotationNumber(),
      subtotal: totals.subtotal,
      total: totals.total,
    },
  );

  return {
    id: result.quotationId,
    number: result.number,
  };
}
