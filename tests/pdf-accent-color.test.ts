import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PDF_ACCENT_COLOR,
  normalizePdfAccentColor,
} from "../lib/pdf-accent-color";

test("normalizePdfAccentColor accepts hex values with or without hash", () => {
  assert.equal(normalizePdfAccentColor("#f59e0b"), "#F59E0B");
  assert.equal(normalizePdfAccentColor("10B981"), "#10B981");
});

test("normalizePdfAccentColor falls back to default for invalid values", () => {
  assert.equal(normalizePdfAccentColor("blue"), DEFAULT_PDF_ACCENT_COLOR);
  assert.equal(normalizePdfAccentColor(null), DEFAULT_PDF_ACCENT_COLOR);
});
