import type { InvoiceScanItemDraft, InvoiceScanResult } from "@/types";

export type InvoiceReviewDestination = "quotation" | "catalog" | "discard";

export type EditableInvoiceReviewItem = InvoiceScanItemDraft & {
  id: string;
  destination: InvoiceReviewDestination;
};

export function createInvoiceReviewItems(
  result: InvoiceScanResult | null,
): EditableInvoiceReviewItem[] {
  if (!result) {
    return [];
  }

  return result.items.map((item, index) => ({
    id: `invoice-item-${index + 1}`,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    destination: "quotation",
  }));
}

export function updateInvoiceReviewDestination(
  rows: EditableInvoiceReviewItem[],
  rowId: string,
  destination: InvoiceReviewDestination,
): EditableInvoiceReviewItem[] {
  return rows.map((row) =>
    row.id === rowId ? { ...row, destination } : row,
  );
}

export function markSavedCatalogRows(
  rows: EditableInvoiceReviewItem[],
  savedRowIds: string[],
): EditableInvoiceReviewItem[] {
  const savedRowIdSet = new Set(savedRowIds);

  return rows.map((row) =>
    row.destination === "catalog" && savedRowIdSet.has(row.id)
      ? { ...row, destination: "discard" }
      : row,
  );
}

export function removeAppliedQuotationRows(rows: EditableInvoiceReviewItem[]) {
  return rows.filter((row) => row.destination !== "quotation");
}

export function toInvoiceDraft(row: EditableInvoiceReviewItem): InvoiceScanItemDraft {
  return {
    name: row.name,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: row.unitPrice,
  };
}
