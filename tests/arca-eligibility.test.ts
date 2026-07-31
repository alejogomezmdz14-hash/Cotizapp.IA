import assert from "node:assert/strict";
import test from "node:test";

import { isFiscalProfileComplete } from "../lib/arca/eligibility";

const complete = {
  cuit: "20-12345678-9",
  sales_point: "0001",
  contributor_type: "monotributista",
};

test("acepta un perfil monotributista completo", () => {
  assert.equal(isFiscalProfileComplete(complete), true);
});

test("rechaza null", () => {
  assert.equal(isFiscalProfileComplete(null), false);
});

test("rechaza si falta cuit o punto de venta", () => {
  assert.equal(isFiscalProfileComplete({ ...complete, cuit: "" }), false);
  assert.equal(isFiscalProfileComplete({ ...complete, sales_point: null }), false);
});

test("rechaza si no es monotributista (v1 solo Factura C)", () => {
  assert.equal(
    isFiscalProfileComplete({ ...complete, contributor_type: "responsable_inscripto" }),
    false,
  );
});

test("no exige certificado: eso se verifica aparte, contra fiscal_credentials", () => {
  assert.equal(isFiscalProfileComplete(complete), true);
});
