import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDateInputHint,
  normalizeDateOnlyString,
  sanitizeQuotationValidityDate,
} from "../lib/quotation-validity";

test("normalizeDateOnlyString accepts ISO timestamps and compact dates", () => {
  assert.equal(
    normalizeDateOnlyString("2026-06-30T00:00:00.000000+00:00"),
    "2026-06-30",
  );
  assert.equal(normalizeDateOnlyString("20260630"), "2026-06-30");
});

test("normalizeDateOnlyString rejects invalid years from timestamp misuse", () => {
  assert.equal(normalizeDateOnlyString("7986-05-27"), null);
  assert.equal(normalizeDateOnlyString("2002-13-40"), null);
});

test("sanitizeQuotationValidityDate returns normalized date-only values", () => {
  assert.equal(
    sanitizeQuotationValidityDate("2026-06-30T00:00:00.000Z"),
    "2026-06-30",
  );
});

test("formatDateInputHint renders dates for UI hints", () => {
  assert.equal(formatDateInputHint("2026-05-27"), "27/05/2026");
});
