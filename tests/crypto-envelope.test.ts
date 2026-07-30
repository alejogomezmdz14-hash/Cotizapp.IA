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

test("el IV es aleatorio y no un contador (un contador reusa clave+IV y rompe GCM)", () => {
  // Comparar "son distintos" no alcanza: un contador (0,1,2,...) también da
  // IVs distintos entre sí y pasaría ese assert. El escenario real de riesgo
  // es un deploy serverless donde cada cold start reinicia un contador y
  // varias instancias terminan reusando el mismo par (clave, IV) con GCM,
  // lo que permite recuperar la subclave de autenticación y forjar blobs.
  //
  // Medimos cuántos de los 12 bytes del IV difieren entre dos sellados:
  //   - IV aleatorio: ~12 de 12 bytes difieren casi siempre.
  //   - IV contador:  típicamente difiere sólo el último byte -> 1.
  //   - IV fijo:      0 bytes difieren.
  //
  // El umbral es 6 (no 12) para no ser flaky: exigir 12 exactos fallaría
  // ~4.4% de las veces por una coincidencia casual de un solo byte
  // (P(0 coincidencias en 12 bytes) = (255/256)^12 ≈ 0.955, o sea ~4.5% de
  // las corridas tendrían al menos una coincidencia). Con umbral 6 seguimos
  // muy lejos de lo que produce un contador (1) o un IV fijo (0), sin falsos
  // negativos por azar.
  const a = seal(KEY_A, SECRET, AAD_USER_A);
  const b = seal(KEY_A, SECRET, AAD_USER_A);
  const ivA = a.subarray(6, 18);
  const ivB = b.subarray(6, 18);

  let diffBytes = 0;
  for (let i = 0; i < 12; i++) {
    if (ivA[i] !== ivB[i]) diffBytes++;
  }

  assert.ok(
    diffBytes >= 6,
    `el IV debería variar en casi todos sus bytes entre dos sellados; sólo difieren ${diffBytes} de 12 (¿contador o IV fijo?)`,
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

test("open rechaza un blob con magic invalido (largo valido, no es el caso de blob corto)", () => {
  // Antes este test usaba Buffer.from("cualquier cosa"), que mide 14 bytes:
  // corta por el chequeo de largo y nunca llega a comparar el magic, quedando
  // como un duplicado del test de blob truncado. Acá el blob tiene el largo
  // correcto y sólo el magic está mal, para ejercitar de verdad ese chequeo.
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  blob.write("ZZZZ", 0, "ascii");
  assert.throws(() => open([KEY_A], blob, AAD_USER_A), EnvelopeError);
});

test("open rechaza una version de sobre no soportada", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  blob[4] = 99; // pisa el byte de versión (offset 4), el resto queda intacto
  assert.throws(() => open([KEY_A], blob, AAD_USER_A), EnvelopeError);
});

test("seal rechaza una clave que no mide 32 bytes", () => {
  const badKey: EnvelopeKey = { keyId: 9, key: randomBytes(16) };
  assert.throws(() => seal(badKey, SECRET, AAD_USER_A), EnvelopeError);
});

test("open rechaza un blob truncado", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.throws(() => open([KEY_A], blob.subarray(0, 20), AAD_USER_A), EnvelopeError);
});

// --- Hallazgo 1: open no debe dejar escapar excepciones crudas de Node ---
//
// La columna que va a guardar este blob es `bytea` de Postgres: según el
// driver puede volver como Buffer, Uint8Array o string hexadecimal. `open`
// tiene que convertir cualquier entrada inesperada en un EnvelopeError, nunca
// en un TypeError/RangeError crudo de Node.

test("open rechaza un blob que no es un Buffer (Uint8Array)", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  const notABuffer = new Uint8Array(blob); // mismo contenido, pero no es Buffer
  assert.throws(
    () => open([KEY_A], notABuffer as unknown as Buffer, AAD_USER_A),
    EnvelopeError,
  );
});

test("open rechaza un blob que llega como string (ej. bytea en hex)", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.throws(
    () => open([KEY_A], blob.toString("hex") as unknown as Buffer, AAD_USER_A),
    EnvelopeError,
  );
});

test("open rechaza blob null sin explotar con TypeError crudo", () => {
  assert.throws(
    () => open([KEY_A], null as unknown as Buffer, AAD_USER_A),
    EnvelopeError,
  );
});

test("open rechaza keys null sin explotar con TypeError crudo", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  assert.throws(
    () => open(null as unknown as EnvelopeKey[], blob, AAD_USER_A),
    EnvelopeError,
  );
});

test("open rechaza una clave de 16 bytes en el ring en vez de RangeError crudo", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  const shortKeyRing: EnvelopeKey[] = [{ keyId: 1, key: randomBytes(16) }];
  assert.throws(() => open(shortKeyRing, blob, AAD_USER_A), EnvelopeError);
});

// --- Hallazgo 4: vector de prueba fijo (known-answer test) ---
//
// Generado UNA sola vez sellando KAT_PLAINTEXT con KAT_KEY / KAT_KEY_ID /
// KAT_AAD y pegando el blob resultante en hexadecimal como constante.
//
// ¡ATENCIÓN! Si este test se rompe, cambió el formato del sobre (offsets,
// reparto interno iv/tag, orden de los campos, etc.) y TODO el material fiscal
// ya guardado en producción (claves privadas de ARCA de usuarios reales) dejó
// de ser legible con el código nuevo. No "arregles" este test regenerando el
// vector sin más: eso esconde una migración de datos obligatoria. Pará y
// confirmá explícitamente que se acepta romper compatibilidad hacia atrás
// (lo que implica re-cifrar el material de todos los usuarios existentes)
// antes de tocar este vector.
const KAT_KEY = Buffer.from(
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  "hex",
);
const KAT_KEY_ID = 7;
const KAT_AAD = "kat-user|fiscal-private-key";
const KAT_PLAINTEXT = "vector-de-prueba-fijo";
const KAT_BLOB_HEX =
  "435a464b01074a2752aa86216c94829b642f1d464b6f4216d4eaed72c497905109ba713895e6666f5e26e009639fbc5b242d28ce443b48";

test("vector de prueba fijo (known-answer test) ancla el formato del sobre", () => {
  const blob = Buffer.from(KAT_BLOB_HEX, "hex");

  // 34 bytes de header (4 magic + 1 version + 1 keyId + 12 iv + 16 tag) +
  // 21 bytes de ciphertext (mismo largo que KAT_PLAINTEXT en utf8).
  assert.equal(blob.length, 34 + Buffer.byteLength(KAT_PLAINTEXT));
  assert.equal(blob.subarray(0, 4).toString("ascii"), "CZFK"); // magic
  assert.equal(blob[4], 1); // version
  assert.equal(blob[5], KAT_KEY_ID); // keyId
  assert.equal(blob.subarray(6, 18).length, 12); // iv
  assert.equal(blob.subarray(18, 34).length, 16); // tag

  const opened = open([{ keyId: KAT_KEY_ID, key: KAT_KEY }], blob, KAT_AAD);
  assert.equal(opened.toString("utf8"), KAT_PLAINTEXT);
});

// --- Hallazgo 5: keyId fuera de 0..255 se trunca en silencio ---
//
// Buffer.from([version, keyId]) aplica "& 255" al armar el header, pero la
// AAD se arma con `${keyId}` sin truncar. Un keyId como 256 guardaría un blob
// con byte de keyId = 0 pero AAD "...|256|...": el material queda ilegible
// para siempre, y recién se nota al intentar facturar meses después.

test("seal rechaza un keyId fuera de 0..255 (256 se trunca en silencio en el byte)", () => {
  const badKey: EnvelopeKey = { keyId: 256, key: randomBytes(32) };
  assert.throws(() => seal(badKey, SECRET, AAD_USER_A), EnvelopeError);
});

test("seal rechaza un keyId negativo", () => {
  const badKey: EnvelopeKey = { keyId: -1, key: randomBytes(32) };
  assert.throws(() => seal(badKey, SECRET, AAD_USER_A), EnvelopeError);
});

test("seal rechaza un keyId no entero", () => {
  const badKey: EnvelopeKey = { keyId: 1.5, key: randomBytes(32) };
  assert.throws(() => seal(badKey, SECRET, AAD_USER_A), EnvelopeError);
});

test("open rechaza un ring con un keyId fuera de 0..255", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  const badRing = [{ keyId: 256, key: randomBytes(32) } as EnvelopeKey, KEY_A];
  assert.throws(() => open(badRing, blob, AAD_USER_A), EnvelopeError);
});

test("open rechaza un ring con keyId como string (típico de un env var, no matchea por igualdad estricta)", () => {
  const blob = seal(KEY_A, SECRET, AAD_USER_A);
  const badRing = [{ keyId: "1", key: KEY_A.key } as unknown as EnvelopeKey];
  assert.throws(() => open(badRing, blob, AAD_USER_A), EnvelopeError);
});
