import assert from "node:assert/strict";
import test from "node:test";

import { pasoDelWizard } from "../lib/fiscal/estado";

const base = {
  tieneDatosFiscales: false,
  tieneLlave: false,
  tieneCertificado: false,
  verificado: false,
  certVencido: false,
};

test("sin datos fiscales, el primer paso es cargarlos", () => {
  assert.equal(pasoDelWizard(base), "datos");
});

test("con datos pero sin llave, toca generarla", () => {
  assert.equal(pasoDelWizard({ ...base, tieneDatosFiscales: true }), "generar");
});

test("con llave y sin certificado, toca el tramite en ARCA", () => {
  assert.equal(
    pasoDelWizard({ ...base, tieneDatosFiscales: true, tieneLlave: true }),
    "tramite",
  );
});

test("con certificado sin verificar, toca probar la conexion", () => {
  assert.equal(
    pasoDelWizard({
      ...base,
      tieneDatosFiscales: true,
      tieneLlave: true,
      tieneCertificado: true,
    }),
    "verificar",
  );
});

test("verificado y vigente, esta listo", () => {
  assert.equal(
    pasoDelWizard({
      tieneDatosFiscales: true,
      tieneLlave: true,
      tieneCertificado: true,
      verificado: true,
      certVencido: false,
    }),
    "listo",
  );
});

test("un certificado vencido vuelve al tramite aunque este verificado", () => {
  assert.equal(
    pasoDelWizard({
      tieneDatosFiscales: true,
      tieneLlave: true,
      tieneCertificado: true,
      verificado: true,
      certVencido: true,
    }),
    "tramite",
  );
});

test("sin datos fiscales gana el primer paso aunque haya llave", () => {
  assert.equal(pasoDelWizard({ ...base, tieneLlave: true }), "datos");
});
