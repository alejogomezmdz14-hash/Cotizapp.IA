import assert from "node:assert/strict";
import test from "node:test";

import { ArcaEmissionError } from "../lib/arca/billing";
import { decidirAnteError } from "../lib/arca/emission-outcome";

test("un rechazo explicito de ARCA libera: no hay comprobante", () => {
  assert.equal(
    decidirAnteError(new ArcaEmissionError("CUIT inválido"), true),
    "liberar",
  );
});

test("cualquier error antes de llamar a ARCA libera", () => {
  assert.equal(decidirAnteError(new Error("lo que sea"), false), "liberar");
  assert.equal(decidirAnteError(new Error("ETIMEDOUT"), false), "liberar");
});

test("un timeout DESPUES de llamar deja la cotizacion en revision", () => {
  // No sabemos si ARCA llegó a emitir. Liberar sería habilitar una segunda
  // factura real sobre la misma cotización.
  assert.equal(decidirAnteError(new Error("ETIMEDOUT"), true), "revisar");
  assert.equal(decidirAnteError(new Error("socket hang up"), true), "revisar");
  assert.equal(decidirAnteError(new Error("ECONNRESET"), true), "revisar");
});

test("ante la duda, revisar: nunca liberamos sin saber", () => {
  assert.equal(decidirAnteError(new Error("algo rarisimo"), true), "revisar");
  assert.equal(decidirAnteError(null, true), "revisar");
});
