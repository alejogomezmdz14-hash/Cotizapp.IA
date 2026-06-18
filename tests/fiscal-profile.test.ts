import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidCuitFormat,
  normalizeCuit,
  normalizeContributorType,
  normalizeSalesPoint,
} from "../lib/fiscal-profile";

test("normalizeCuit formatea 11 dígitos a XX-XXXXXXXX-X", () => {
  assert.equal(normalizeCuit("20123456789"), "20-12345678-9");
  assert.equal(normalizeCuit("20-12345678-9"), "20-12345678-9");
  assert.equal(normalizeCuit(" 20 12345678 9 "), "20-12345678-9");
});

test("normalizeCuit devuelve el original (trim) si no son 11 dígitos", () => {
  assert.equal(normalizeCuit("123"), "123");
});

test("isValidCuitFormat acepta solo el formato XX-XXXXXXXX-X", () => {
  assert.equal(isValidCuitFormat("20-12345678-9"), true);
  assert.equal(isValidCuitFormat("20123456789"), false);
  assert.equal(isValidCuitFormat("2-12345678-9"), false);
  assert.equal(isValidCuitFormat(""), false);
});

test("normalizeContributorType valida los dos tipos", () => {
  assert.equal(normalizeContributorType("monotributista"), "monotributista");
  assert.equal(
    normalizeContributorType("Responsable_Inscripto"),
    "responsable_inscripto",
  );
  assert.equal(normalizeContributorType("otro"), null);
});

test("normalizeSalesPoint deja solo dígitos y rellena a 4", () => {
  assert.equal(normalizeSalesPoint("1"), "0001");
  assert.equal(normalizeSalesPoint("0001"), "0001");
  assert.equal(normalizeSalesPoint("12"), "0012");
  assert.equal(normalizeSalesPoint("abc1"), "0001");
  assert.equal(normalizeSalesPoint(""), "");
});
