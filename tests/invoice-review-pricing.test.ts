import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInvoiceReviewMargin,
  createInvoiceReviewItems,
  parseInvoiceDecimalValue,
  toInvoiceDraft,
} from "../lib/invoice-scan/review";
import type { InvoiceScanResult } from "../types";

test("parseInvoiceDecimalValue trata los puntos de miles argentinos como miles", () => {
  assert.equal(parseInvoiceDecimalValue("47.716"), 47716);
  assert.equal(parseInvoiceDecimalValue("1.500"), 1500);
  assert.equal(parseInvoiceDecimalValue("1.500.000"), 1500000);
});

test("parseInvoiceDecimalValue respeta la coma decimal", () => {
  assert.equal(parseInvoiceDecimalValue("47.716,93"), 47716.93);
  assert.equal(parseInvoiceDecimalValue("47,72"), 47.72);
  assert.equal(parseInvoiceDecimalValue("0,5"), 0.5);
});

test("parseInvoiceDecimalValue mantiene decimales con punto de 1-2 dígitos", () => {
  assert.equal(parseInvoiceDecimalValue("47.72"), 47.72);
  assert.equal(parseInvoiceDecimalValue("47.7"), 47.7);
  assert.equal(parseInvoiceDecimalValue("47716.93"), 47716.93);
});

test("parseInvoiceDecimalValue tolera símbolos y vacíos", () => {
  assert.equal(parseInvoiceDecimalValue("$ 1.500"), 1500);
  assert.equal(parseInvoiceDecimalValue(""), 0);
  assert.equal(parseInvoiceDecimalValue("abc"), 0);
});

test("applyInvoiceReviewMargin suma el margen sobre el costo y redondea", () => {
  assert.equal(applyInvoiceReviewMargin(100, 30), 130);
  assert.equal(applyInvoiceReviewMargin(47716.93, 0), 47716.93);
  assert.equal(applyInvoiceReviewMargin(33.33, 50), 50);
  assert.equal(applyInvoiceReviewMargin(100, -10), 100);
});

function buildScanResult(): InvoiceScanResult {
  return {
    supplierName: "Proveedor SA",
    invoiceNumber: "0001-1234",
    invoiceDate: "2026-06-12",
    currency: "ARS",
    notes: null,
    warnings: [],
    items: [
      {
        name: "COOKMILD 10X10",
        description: null,
        quantity: 1,
        unit: "Unit",
        unitPrice: 47716.929,
      },
    ],
  } as InvoiceScanResult;
}

test("createInvoiceReviewItems normaliza unidad en inglés y redondea el costo", () => {
  const rows = createInvoiceReviewItems(buildScanResult());

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.unit, "unidad");
  assert.equal(rows[0]?.unitPrice, 47716.93);
  assert.equal(rows[0]?.marginPct, 0);
  assert.equal(rows[0]?.destination, "quotation");
});

test("toInvoiceDraft aplica el margen del ítem al precio final", () => {
  const rows = createInvoiceReviewItems(buildScanResult());
  const row = { ...rows[0]!, marginPct: 30 };

  const draft = toInvoiceDraft(row);

  assert.equal(draft.unitPrice, 62032.01);
  assert.equal(draft.unit, "unidad");
});
