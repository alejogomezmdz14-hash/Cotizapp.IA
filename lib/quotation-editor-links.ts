import { isDraftQuotationStatus } from "@/lib/quotation-status";
import type { Quotation } from "@/types";

export function getDraftQuotationEditorHref(
  quotation: Pick<Quotation, "id" | "status">,
) {
  return isDraftQuotationStatus(quotation.status)
    ? `/cotizaciones/nueva?quotationId=${quotation.id}&edit=1`
    : null;
}
