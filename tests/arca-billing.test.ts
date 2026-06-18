import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFacturaCRequest,
  formatNumeroFactura,
  parseArcaDate,
} from "../lib/arca/billing";

test("buildFacturaCRequest arma una Factura C sin IVA", () => {
  const req = buildFacturaCRequest(
    { salesPoint: "0001", total: 1500, date: new Date("2026-06-18T12:00:00Z") },
    122,
  );

  assert.equal(req.CantReg, 1);
  assert.equal(req.PtoVta, 1);
  assert.equal(req.CbteTipo, 11); // Factura C
  assert.equal(req.Concepto, 1); // Productos
  assert.equal(req.DocTipo, 99); // Consumidor Final
  assert.equal(req.DocNro, 0);
  assert.equal(req.CondicionIVAReceptorId, 5); // Consumidor Final
  assert.equal(req.CbteDesde, 123); // último + 1
  assert.equal(req.CbteHasta, 123);
  assert.equal(req.CbteFch, "20260618");
  assert.equal(req.ImpTotal, 1500);
  assert.equal(req.ImpNeto, 1500); // C no discrimina: neto = total
  assert.equal(req.ImpIVA, 0);
  assert.equal(req.MonId, "PES");
  assert.equal(req.MonCotiz, 1);
  assert.equal((req as { Iva?: unknown }).Iva, undefined); // sin alícuotas
});

test("buildFacturaCRequest redondea el total a 2 decimales", () => {
  const req = buildFacturaCRequest(
    { salesPoint: "1", total: 1500.005, date: new Date("2026-01-02T00:00:00Z") },
    0,
  );
  assert.equal(req.ImpTotal, 1500.01);
  assert.equal(req.ImpNeto, 1500.01);
  assert.equal(req.CbteFch, "20260102");
});

test("formatNumeroFactura usa PtoVta-Comprobante con padding", () => {
  assert.equal(formatNumeroFactura("0001", 123), "0001-00000123");
  assert.equal(formatNumeroFactura("1", 7), "0001-00000007");
});

test("parseArcaDate convierte YYYYMMDD a ISO date", () => {
  assert.equal(parseArcaDate("20260918"), "2026-09-18");
});
