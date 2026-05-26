import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateQuotationLineTotal,
  calculateQuotationTotals,
} from "../lib/quotation-calculations";

test("calculateQuotationLineTotal rounds quantity by unit price to two decimals", () => {
  assert.equal(calculateQuotationLineTotal(1.5, 99.99), 149.99);
});

test("calculateQuotationTotals returns rounded subtotal, tax and total", () => {
  assert.deepEqual(
    calculateQuotationTotals(
      [
        { quantity: 2, unitPrice: 1250.5 },
        { quantity: 1.5, unitPrice: 99.99 },
      ],
      21,
    ),
    {
      subtotal: 2650.99,
      taxAmount: 556.71,
      total: 3207.7,
    },
  );
});

test("calculateQuotationTotals returns zeros when there are no items", () => {
  assert.deepEqual(calculateQuotationTotals([], 21), {
    subtotal: 0,
    taxAmount: 0,
    total: 0,
  });
});
