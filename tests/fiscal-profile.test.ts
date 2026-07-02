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
  assert.equal(isValidCuitFormat("20-12345678-6"), true);
  assert.equal(isValidCuitFormat("20123456786"), false);
  assert.equal(isValidCuitFormat("2-12345678-9"), false);
  assert.equal(isValidCuitFormat(""), false);
});

test("isValidCuitFormat valida el dígito verificador (módulo 11 de AFIP)", () => {
  // Verificador correcto: pesos [5,4,3,2,7,6,5,4,3,2] → 148 % 11 = 5 → 11 - 5 = 6.
  assert.equal(isValidCuitFormat("20-12345678-6"), true);
  // CUIT real (AFIP): 145 % 11 = 2 → 11 - 2 = 9.
  assert.equal(isValidCuitFormat("33-69345023-9"), true);
  // Caso borde 11 → 0: 198 % 11 = 0 → dígito esperado 0.
  assert.equal(isValidCuitFormat("30-71659554-0"), true);
  // Caso borde 10 → 9: 12 % 11 = 1 → 11 - 1 = 10 → dígito esperado 9.
  assert.equal(isValidCuitFormat("20-00000001-9"), true);

  // Formato correcto pero verificador inválido: debe rechazarse.
  assert.equal(isValidCuitFormat("20-12345678-9"), false);
  assert.equal(isValidCuitFormat("33-69345023-1"), false);
  assert.equal(isValidCuitFormat("20-00000001-0"), false);
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
