import assert from "node:assert/strict";
import test from "node:test";

import { buildAfipQrUrl } from "../lib/arca/factura-qr";

test("buildAfipQrUrl arma la URL de AFIP con el payload base64", () => {
  const url = buildAfipQrUrl({
    fecha: "2026-06-28",
    cuit: 20447575354,
    ptoVta: 1,
    tipoCmp: 11,
    nroCmp: 1,
    importe: 3066569.05,
    moneda: "PES",
    ctz: 1,
    codAut: 86300691736661,
  });

  assert.ok(url.startsWith("https://www.afip.gob.ar/fe/qr/?p="));

  const base64 = url.split("?p=")[1];
  const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));

  assert.equal(payload.ver, 1);
  assert.equal(payload.fecha, "2026-06-28");
  assert.equal(payload.cuit, 20447575354);
  assert.equal(payload.ptoVta, 1);
  assert.equal(payload.tipoCmp, 11);
  assert.equal(payload.nroCmp, 1);
  assert.equal(payload.importe, 3066569.05);
  assert.equal(payload.moneda, "PES");
  assert.equal(payload.ctz, 1);
  assert.equal(payload.tipoDocRec, 99); // Consumidor Final por defecto
  assert.equal(payload.nroDocRec, 0);
  assert.equal(payload.tipoCodAut, "E"); // CAE
  assert.equal(payload.codAut, 86300691736661);
});
