export type QuotationCalculationItem = {
  quantity: number;
  unitPrice: number;
};

export type QuotationTotals = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

function normalizeAmount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function roundAmount(value: number) {
  return Math.round((normalizeAmount(value) + 1e-9) * 100) / 100;
}

export function calculateQuotationLineTotal(quantity: number, unitPrice: number) {
  return roundAmount(normalizeAmount(quantity) * normalizeAmount(unitPrice));
}

export function calculateQuotationSubtotal(items: QuotationCalculationItem[]) {
  return roundAmount(
    items.reduce((runningTotal, item) => {
      return runningTotal + calculateQuotationLineTotal(item.quantity, item.unitPrice);
    }, 0),
  );
}

export function calculateQuotationTaxAmount(subtotal: number, taxRate: number) {
  const normalizedTaxRate = Math.max(0, normalizeAmount(taxRate));
  return roundAmount(subtotal * (normalizedTaxRate / 100));
}

export function calculateQuotationTotals(
  items: QuotationCalculationItem[],
  taxRate: number,
): QuotationTotals {
  const subtotal = calculateQuotationSubtotal(items);
  const taxAmount = calculateQuotationTaxAmount(subtotal, taxRate);

  return {
    subtotal,
    taxAmount,
    total: roundAmount(subtotal + taxAmount),
  };
}
