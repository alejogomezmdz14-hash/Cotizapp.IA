import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  EnvelopeError,
  open,
  seal,
  type EnvelopeKey,
} from "../lib/crypto/envelope";

const KEY_A: EnvelopeKey = { keyId: 1, key: randomBytes(32) };
const KEY_B: EnvelopeKey = { keyId: 2, key: randomBytes(32) };

const AAD_USER_A = "user_aaa|fiscal-private-key";
const AAD_USER_B = "user_bbb|fiscal-private-key";

const SECRET = "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n";

test("seal y open hacen ida y vuelta", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.equal(open([KEY_A], blob, AAD_USER_A).toString("utf8"), SECRET);
});

test("el sobre tiene el layout documentado", () => {
  const blob = seal(KEY_A, "hola", AAD_USER_A);
  assert.equal(blob.subarray(0, 4).toString("ascii"), "CZFK");
  assert.equal(blob[4], 1); // version
  assert.equal(blob[5], 1); // keyId
  assert.equal(blob.length, 34 + Buffer.byteLength("hola"));
});

test("cifrar dos veces el mismo texto da blobs distintos (IV aleatorio)", () => {
  const a = seal(KEY_A, SECRET, AAD_USER_A);
  const b = seal(KEY_A, SECRET, AAD_USER_A);
  assert.notEqual(a.toString("base64"), b.toString("base64"));
  // Y el IV concreto tampoco se repite.
  assert.notEqual(
    a.subarray(6, 18).toString("hex"),
    b.subarray(6, 18).toString("hex"),
  );
});

test("un blob de un usuario no se abre con la AAD de otro", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.throws(() => open([KEY_A], blob, AAD_USER_B), EnvelopeError);
});

test("corromper un byte del ciphertext hace fallar la autenticacion", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  blob[blob.length - 1] ^= 0xff;
  assert.throws(() => open([KEY_A], blob, AAD_USER_A), EnvelopeError);
});

test("corromper el authTag hace fallar la autenticacion", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  blob[20] ^= 0xff; // dentro del tag (offset 18..33)
  assert.throws(() => open([KEY_A], blob, AAD_USER_A), EnvelopeError);
});

test("open elige la clave por keyId y soporta rotacion", () => {
  const blob = seal(KEY_B, SECRET, AAD_USER_A);
  assert.equal(open([KEY_A, KEY_B], blob, AAD_USER_A).toString("utf8"), SECRET);
});

test("open falla si no tiene la clave del keyId del blob", () => {
  const blob = seal(KEY_B, SECRET, AAD_USER_A);
  assert.throws(() => open([KEY_A], blob, AAD_USER_A), EnvelopeError);
});

test("open rechaza un blob que no es del formato", () => {
  assert.throws(
    () => open([KEY_A], Buffer.from("cualquier cosa"), AAD_USER_A),
    EnvelopeError,
  );
});

test("open rechaza un blob truncado", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.throws(() => open([KEY_A], blob.subarray(0, 20), AAD_USER_A), EnvelopeError);
});
