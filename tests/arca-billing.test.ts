import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFacturaCRequest,
  formatNumeroFactura,
  parseArcaDate,
  simulateFacturaC,
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

test("simulateFacturaC genera un CAE y número marcados como DEMO", () => {
  const result = simulateFacturaC("0001", 7, new Date("2026-06-18T12:00:00Z"));
  assert.equal(result.numeroComprobante, 7);
  assert.equal(result.numeroFactura, "DEMO-0001-00000007");
  assert.equal(result.cae, "70000000000007");
  assert.equal(result.caeVencimiento, "2026-06-28"); // +10 días
});

import {
  ArcaEmissionError,
  issueFacturaC,
  type ElectronicBilling,
  type FacturaCRequest,
  type VoucherEmissionOutcome,
} from "../lib/arca/billing";

function fakeBilling(
  outcome?: Partial<VoucherEmissionOutcome>,
  last = 122,
): { billing: ElectronicBilling; calls: { request?: FacturaCRequest } } {
  const calls: { request?: FacturaCRequest } = {};
  return {
    calls,
    billing: {
      getLastVoucherNumber: async () => last,
      createVoucher: async (request) => {
        calls.request = request;
        return {
          approved: true,
          cae: "75123456789012",
          caeVencimiento: "20260928",
          observations: null,
          ...outcome,
        };
      },
    },
  };
}

test("issueFacturaC devuelve el CAE y el número formateado en éxito", async () => {
  const { billing, calls } = fakeBilling();
  const result = await issueFacturaC(billing, {
    salesPoint: "0001",
    total: 1500,
    date: new Date("2026-06-18T12:00:00Z"),
  });

  assert.equal(result.cae, "75123456789012");
  assert.equal(result.caeVencimiento, "2026-09-28");
  assert.equal(result.numeroComprobante, 123);
  assert.equal(result.numeroFactura, "0001-00000123");
  assert.equal(calls.request?.CbteDesde, 123);
});

test("issueFacturaC lanza ArcaEmissionError si ARCA rechaza", async () => {
  const { billing } = fakeBilling({
    approved: false,
    cae: "",
    observations: "CUIT inválido",
  });

  await assert.rejects(
    () =>
      issueFacturaC(billing, {
        salesPoint: "0001",
        total: 1500,
        date: new Date("2026-06-18T12:00:00Z"),
      }),
    (err: unknown) => err instanceof ArcaEmissionError,
  );
});
