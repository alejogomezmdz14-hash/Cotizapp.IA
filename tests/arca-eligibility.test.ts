import assert from "node:assert/strict";
import test from "node:test";

import { isFiscalProfileComplete } from "../lib/arca/eligibility";

const complete = {
  cuit: "20-12345678-9",
  sales_point: "0001",
  contributor_type: "monotributista",
  cert_path: "user_x/cert.crt",
  key_path: "user_x/private.key",
};

test("acepta un perfil monotributista completo", () => {
  assert.equal(isFiscalProfileComplete(complete), true);
});

test("rechaza null", () => {
  assert.equal(isFiscalProfileComplete(null), false);
});

test("rechaza si falta el certificado o la clave", () => {
  assert.equal(isFiscalProfileComplete({ ...complete, cert_path: null }), false);
  assert.equal(isFiscalProfileComplete({ ...complete, key_path: "" }), false);
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

test("en modo demo NO exige certificado ni clave", () => {
  assert.equal(
    isFiscalProfileComplete({
      cuit: "20-12345678-9",
      sales_point: "0001",
      contributor_type: "monotributista",
      cert_path: null,
      key_path: null,
      environment: "demo",
    }),
    true,
  );
});

test("en modo demo igual exige CUIT, punto de venta y monotributista", () => {
  assert.equal(
    isFiscalProfileComplete({
      cuit: "",
      sales_point: "0001",
      contributor_type: "monotributista",
      cert_path: null,
      key_path: null,
      environment: "demo",
    }),
    false,
  );
});
