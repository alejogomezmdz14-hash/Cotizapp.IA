import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { ACTIVE_KEY_ID, parseFiscalKeyring } from "../lib/crypto/fiscal-key";

const VALID = randomBytes(32).toString("base64");
const VALID_PREVIOUS = randomBytes(32).toString("base64");

test("acepta una clave base64 de 32 bytes", () => {
  const keyring = parseFiscalKeyring({ FISCAL_ENCRYPTION_KEY: VALID });
  assert.equal(keyring.active.keyId, ACTIVE_KEY_ID);
  assert.equal(keyring.active.key.byteLength, 32);
  assert.equal(keyring.all.length, 1);
});

test("suma la clave anterior para poder rotar", () => {
  const keyring = parseFiscalKeyring({
    FISCAL_ENCRYPTION_KEY: VALID,
    FISCAL_ENCRYPTION_KEY_PREVIOUS: VALID_PREVIOUS,
  });
  assert.equal(keyring.all.length, 2);
  assert.equal(keyring.all[1].keyId, ACTIVE_KEY_ID - 1);
  // La activa sigue siendo la primera: es con la que se cifra.
  assert.equal(keyring.all[0].keyId, ACTIVE_KEY_ID);
});

test("falla cerrado si falta la clave", () => {
  assert.throws(() => parseFiscalKeyring({}), /FISCAL_ENCRYPTION_KEY/);
});

test("falla cerrado si la clave esta vacia", () => {
  assert.throws(
    () => parseFiscalKeyring({ FISCAL_ENCRYPTION_KEY: "   " }),
    /FISCAL_ENCRYPTION_KEY/,
  );
});

test("rechaza una clave que no mide 32 bytes", () => {
  const corta = randomBytes(16).toString("base64");
  assert.throws(() => parseFiscalKeyring({ FISCAL_ENCRYPTION_KEY: corta }), /32 bytes/);
});

test("rechaza una clave pegada en hex en vez de base64", () => {
  // 64 chars hex decodificados como base64 dan 48 bytes, no 32.
  const hex = randomBytes(32).toString("hex");
  assert.throws(() => parseFiscalKeyring({ FISCAL_ENCRYPTION_KEY: hex }), /32 bytes/);
});

test("rechaza una clave anterior invalida en vez de ignorarla", () => {
  assert.throws(
    () =>
      parseFiscalKeyring({
        FISCAL_ENCRYPTION_KEY: VALID,
        FISCAL_ENCRYPTION_KEY_PREVIOUS: "corta",
      }),
    /32 bytes/,
  );
});
