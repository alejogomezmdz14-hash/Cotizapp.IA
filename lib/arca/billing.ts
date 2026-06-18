// Emisión de Factura C contra ARCA (ex-AFIP). El SDK @arcasdk/core solo se toca
// en `emitirFacturaC` (adaptador); el resto es puro/testeable vía la interfaz
// ElectronicBilling.
//
// API real confirmada en node_modules/@arcasdk/core@1.3.1:
//   new Arca({ cuit: number, cert, key, production?, useHttpsAgent?, ticketPath? })
//   arca.electronicBillingService.getLastVoucher(salesPoint, type) -> { cbteNro, ... }
//   arca.electronicBillingService.createVoucher(req: IVoucher)
//     -> { cae, caeFchVto (YYYYMMDD), response: { FeCabResp: { Resultado } } }
//   IVoucher exige CondicionIVAReceptorId (Consumidor Final = 5).

export type ArcaEnvironment = "homologacion" | "produccion";

const CBTE_TIPO_FACTURA_C = 11;
const CONCEPTO_PRODUCTOS = 1;
const DOC_TIPO_CONSUMIDOR_FINAL = 99;
const COND_IVA_RECEPTOR_CONSUMIDOR_FINAL = 5;

export type FacturaCInput = {
  salesPoint: string;
  total: number;
  date: Date;
};

export type FacturaCRequest = {
  CantReg: number;
  PtoVta: number;
  CbteTipo: number;
  Concepto: number;
  DocTipo: number;
  DocNro: number;
  CbteDesde: number;
  CbteHasta: number;
  CbteFch: string;
  ImpTotal: number;
  ImpTotConc: number;
  ImpNeto: number;
  ImpOpEx: number;
  ImpIVA: number;
  ImpTrib: number;
  MonId: string;
  MonCotiz: number;
  CondicionIVAReceptorId: number;
};

export type FacturaCResult = {
  cae: string;
  caeVencimiento: string; // ISO date YYYY-MM-DD
  numeroComprobante: number;
  numeroFactura: string; // "0001-00000123"
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCbteFch(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function salesPointToNumber(salesPoint: string): number {
  return Number(salesPoint.replace(/\D/g, "")) || 0;
}

export function buildFacturaCRequest(
  input: FacturaCInput,
  lastVoucherNumber: number,
): FacturaCRequest {
  const total = round2(input.total);
  const nextNumber = lastVoucherNumber + 1;

  return {
    CantReg: 1,
    PtoVta: salesPointToNumber(input.salesPoint),
    CbteTipo: CBTE_TIPO_FACTURA_C,
    Concepto: CONCEPTO_PRODUCTOS,
    DocTipo: DOC_TIPO_CONSUMIDOR_FINAL,
    DocNro: 0,
    CbteDesde: nextNumber,
    CbteHasta: nextNumber,
    CbteFch: formatCbteFch(input.date),
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total, // Factura C: neto = total, sin IVA discriminado
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: COND_IVA_RECEPTOR_CONSUMIDOR_FINAL,
  };
}

export function formatNumeroFactura(
  salesPoint: string,
  numeroComprobante: number,
): string {
  const pv = salesPointToNumber(salesPoint).toString().padStart(4, "0");
  return `${pv}-${String(numeroComprobante).padStart(8, "0")}`;
}

export function parseArcaDate(yyyymmdd: string): string {
  const value = yyyymmdd.trim();
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
