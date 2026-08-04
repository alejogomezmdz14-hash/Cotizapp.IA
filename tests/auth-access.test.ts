import assert from "node:assert/strict";
import test from "node:test";

import { decideAccess, readMetadataFromClaims } from "../lib/auth/access";

const CON_ACCESO = { metadata: { access: "granted" } };
const SIN_ACCESO = { metadata: { onboarded: true } };
const PAGO = { metadata: { plan: "pro" } };
const SIN_METADATA = { sub: "user_123" };

test("con el gate apagado entra cualquiera", () => {
  assert.deepEqual(decideAccess(SIN_ACCESO, false), {
    allowed: true,
    reason: "gate-disabled",
  });
  assert.equal(decideAccess(SIN_METADATA, false).allowed, true);
});

test("con el gate prendido, access granted entra", () => {
  assert.deepEqual(decideAccess(CON_ACCESO, true), {
    allowed: true,
    reason: "granted",
  });
});

test("un plan pago implica acceso aunque no tenga access", () => {
  assert.deepEqual(decideAccess(PAGO, true), {
    allowed: true,
    reason: "paid-plan",
  });
});

test("metadata presente pero sin access: no autorizado", () => {
  assert.deepEqual(decideAccess(SIN_ACCESO, true), {
    allowed: false,
    reason: "not-granted",
  });
});

test("metadata ausente por completo: falla ABIERTO (Clerk mal configurado)", () => {
  // Si el session token no expone publicMetadata, el claim no llega. Bloquear
  // ahí dejaría afuera a todo el mundo, incluido el dueño, sin forma de entrar
  // al dashboard a arreglarlo.
  assert.deepEqual(decideAccess(SIN_METADATA, true), {
    allowed: true,
    reason: "claims-unavailable",
  });
  assert.equal(decideAccess(null, true).reason, "claims-unavailable");
  assert.equal(decideAccess({}, true).reason, "claims-unavailable");
});

test("acepta las variantes de nombre que expone Clerk", () => {
  assert.equal(decideAccess({ publicMetadata: { access: "granted" } }, true).allowed, true);
  assert.equal(decideAccess({ public_metadata: { access: "granted" } }, true).allowed, true);
});

test("el valor de access es tolerante a mayusculas y espacios", () => {
  assert.equal(decideAccess({ metadata: { access: "  GRANTED " } }, true).allowed, true);
});

test("un access desconocido no habilita", () => {
  assert.deepEqual(decideAccess({ metadata: { access: "pendiente" } }, true), {
    allowed: false,
    reason: "not-granted",
  });
});

test("readMetadataFromClaims distingue ausente de vacio", () => {
  assert.equal(readMetadataFromClaims({ sub: "x" }), null);
  assert.deepEqual(readMetadataFromClaims({ metadata: {} }), {});
});
