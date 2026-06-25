// tests/dashboard-variation.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { computeVariationPercent } from "../lib/dashboard-variation";

test("computeVariationPercent calcula la suba porcentual redondeada", () => {
  assert.equal(computeVariationPercent(112, 100), 12);
});

test("computeVariationPercent calcula la baja porcentual", () => {
  assert.equal(computeVariationPercent(90, 100), -10);
});

test("computeVariationPercent devuelve null si el período anterior es 0", () => {
  assert.equal(computeVariationPercent(500, 0), null);
});

test("computeVariationPercent devuelve null con valores no finitos", () => {
  assert.equal(computeVariationPercent(Number.NaN, 100), null);
});
