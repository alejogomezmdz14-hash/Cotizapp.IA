import { normalizeCatalogUnit } from "@/lib/catalog-units";
import type { InvoiceScanItemDraft, InvoiceScanResult } from "@/types";

export type InvoiceReviewDestination = "quotation" | "catalog" | "discard";

export type EditableInvoiceReviewItem = InvoiceScanItemDraft & {
  id: string;
  destination: InvoiceReviewDestination;
  /** Margen de ganancia % sobre el costo detectado en la factura. */
  marginPct: number;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Parsea montos tipeados o detectados por el escaneo, tolerando los formatos
 * argentinos: "47.716" y "1.500.000" son miles; "47.716,93" usa coma decimal.
 */
export function parseInvoiceDecimalValue(rawValue: string) {
  const compactValue = rawValue.trim().replace(/\s+/g, "");

  if (!compactValue) {
    return 0;
  }

  const sanitizedValue = compactValue.replace(/[^\d,.-]/g, "");

  if (/^\d{1,3}(\.\d{3})+$/.test(sanitizedValue)) {
    return Number.parseFloat(sanitizedValue.replace(/\./g, ""));
  }

  if (/^\d{1,3}(,\d{3}){2,}$/.test(sanitizedValue)) {
    return Number.parseFloat(sanitizedValue.replace(/,/g, ""));
  }

  const lastCommaIndex = sanitizedValue.lastIndexOf(",");
  const lastDotIndex = sanitizedValue.lastIndexOf(".");

  let normalizedValue = sanitizedValue;

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
    normalizedValue = sanitizedValue
      .replace(thousandsSeparator, "")
      .replace(decimalSeparator, ".");
  } else if (lastCommaIndex !== -1) {
    const parts = sanitizedValue.split(",");
    normalizedValue =
      parts.length > 2
        ? `${parts.slice(0, -1).join("")}.${parts[parts.length - 1]}`
        : sanitizedValue.replace(",", ".");
  }

  if (!/^\d+(?:\.\d*)?$/.test(normalizedValue)) {
    return 0;
  }

  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export function applyInvoiceReviewMargin(unitPrice: number, marginPct: number) {
  if (!Number.isFinite(marginPct) || marginPct <= 0) {
    return roundCurrency(unitPrice);
  }

  return roundCurrency(unitPrice * (1 + marginPct / 100));
}

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
    unit: normalizeCatalogUnit(item.unit),
    unitPrice: roundCurrency(item.unitPrice),
    destination: "quotation",
    marginPct: 0,
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
    unitPrice: applyInvoiceReviewMargin(row.unitPrice, row.marginPct),
  };
}
