import assert from "node:assert/strict";
import test from "node:test";

import {
  hasActivePlanFromClaims,
  isActivePlan,
  planFromSessionClaims,
} from "../lib/auth/plan";

test("isActivePlan acepta lifetime y pro, ignorando mayúsculas/espacios", () => {
  assert.equal(isActivePlan("lifetime"), true);
  assert.equal(isActivePlan("pro"), true);
  assert.equal(isActivePlan("PRO"), true);
  assert.equal(isActivePlan(" lifetime "), true);
});

test("isActivePlan rechaza cualquier otro valor", () => {
  assert.equal(isActivePlan("free"), false);
  assert.equal(isActivePlan("trial"), false);
  assert.equal(isActivePlan(""), false);
  assert.equal(isActivePlan(null), false);
  assert.equal(isActivePlan(undefined), false);
});

test("planFromSessionClaims lee metadata (forma recomendada del JWT)", () => {
  assert.equal(
    planFromSessionClaims({ metadata: { plan: "lifetime" } }),
    "lifetime",
  );
});

test("planFromSessionClaims tolera publicMetadata y public_metadata", () => {
  assert.equal(
    planFromSessionClaims({ publicMetadata: { plan: "pro" } }),
    "pro",
  );
  assert.equal(
    planFromSessionClaims({ public_metadata: { plan: "lifetime" } }),
    "lifetime",
  );
});

test("planFromSessionClaims devuelve null si no hay plan", () => {
  assert.equal(planFromSessionClaims(null), null);
  assert.equal(planFromSessionClaims({}), null);
  assert.equal(planFromSessionClaims({ metadata: {} }), null);
  assert.equal(planFromSessionClaims({ metadata: { plan: 42 } }), null);
});

test("hasActivePlanFromClaims combina extracción + validación", () => {
  assert.equal(hasActivePlanFromClaims({ metadata: { plan: "pro" } }), true);
  assert.equal(hasActivePlanFromClaims({ metadata: { plan: "free" } }), false);
  assert.equal(hasActivePlanFromClaims(undefined), false);
});
