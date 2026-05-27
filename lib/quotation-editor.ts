import { createClient } from "@/lib/supabase/server";
import { isDraftQuotationStatus, normalizeQuotationStatus } from "@/lib/quotation-status";
import { getHydratedQuotation } from "@/lib/quotations";
import type { QuotationEditorItem } from "@/components/cotizacion/quotation-items-editor";

export type QuotationEditorInitialState = {
  quotationId: string;
  number: string;
  status: string | null;
  clientId: string | null;
  clientName: string | null;
  taxRate: number;
  validUntil: string;
  notes: string;
  items: QuotationEditorItem[];
  pdfGeneratedAt: string | null;
  shareToken: string | null;
  sentAt: string | null;
};

export async function getQuotationEditorState(
  userId: string,
  quotationId: string,
): Promise<QuotationEditorInitialState | null> {
  const hydrated = await getHydratedQuotation(userId, quotationId);

  if (!hydrated || !isDraftQuotationStatus(hydrated.quotation.status)) {
    return null;
  }

  const quotation = hydrated.quotation;

  return {
    quotationId: quotation.id,
    number: quotation.number,
    status: normalizeQuotationStatus(quotation.status),
    clientId: quotation.client_id,
    clientName: quotation.client_name,
    taxRate: quotation.tax_rate ?? 0,
    validUntil: quotation.valid_until ?? "",
    notes: quotation.notes ?? "",
    items: hydrated.items.map((item, index) => ({
      id: item.id ?? `item-${index + 1}`,
      source: item.catalogItemId ? "catalog" : "manual",
      catalogItemId: item.catalogItemId,
      name: item.name,
      description: item.description ?? "",
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    })),
    pdfGeneratedAt: quotation.pdf_generated_at,
    shareToken: quotation.share_token,
    sentAt: quotation.sent_at,
  };
}

export async function assertDraftQuotationOwned(
  userId: string,
  quotationId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("id, status")
    .eq("id", quotationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("La cotización no existe o no te pertenece.");
  }

  if (!isDraftQuotationStatus(normalizeQuotationStatus(data.status))) {
    throw new Error("Solo podés editar cotizaciones en borrador.");
  }

  return data;
}
