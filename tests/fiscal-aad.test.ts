import assert from "node:assert/strict";
import test from "node:test";

import { PURPOSE_PRIVATE_KEY, aadFor } from "../lib/fiscal/aad";

// Fija el valor EXACTO que produce aadFor: lib/fiscal/credentials.ts y
// scripts/migrar-credenciales-fiscales.ts tienen que armar carácter por
// carácter la misma AAD, porque GCM no distingue "clave equivocada" de "AAD
// equivocada" — si este valor cambia sin querer, el material fiscal cifrado
// con la versión vieja deja de poder abrirse. Este test tiene que romper la
// suite antes de que eso llegue a producción.
test("aadFor arma el contexto exacto que usa el sobre criptográfico", () => {
  assert.equal(aadFor("user_x"), "user_x|fiscal-private-key");
});

test("PURPOSE_PRIVATE_KEY es el propósito fijo que compone la AAD", () => {
  assert.equal(PURPOSE_PRIVATE_KEY, "fiscal-private-key");
  assert.equal(aadFor("otro_user"), `otro_user|${PURPOSE_PRIVATE_KEY}`);
});

test("aadFor distingue usuarios distintos", () => {
  assert.notEqual(aadFor("user_a"), aadFor("user_b"));
});
