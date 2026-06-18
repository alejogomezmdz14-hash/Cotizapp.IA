import assert from "node:assert/strict";
import test from "node:test";

import { PROFILE_COUNTRIES, isArgentina } from "../lib/profile-countries";

test("PROFILE_COUNTRIES incluye Argentina", () => {
  assert.ok(PROFILE_COUNTRIES.includes("Argentina"));
});

test("isArgentina reconoce variantes y acentos/espacios", () => {
  assert.equal(isArgentina("Argentina"), true);
  assert.equal(isArgentina("  argentina "), true);
  assert.equal(isArgentina("ARGENTINA"), true);
  assert.equal(isArgentina("AR"), true);
});

test("isArgentina rechaza otros países y vacío", () => {
  assert.equal(isArgentina("México"), false);
  assert.equal(isArgentina(""), false);
  assert.equal(isArgentina(null), false);
});
