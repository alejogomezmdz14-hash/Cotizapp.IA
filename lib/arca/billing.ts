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

function isoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Simula una emisión de Factura C SIN llamar a ARCA (modo demo). Devuelve un CAE
// y un número claramente marcados como "DEMO" para no confundirlos con uno real.
export function simulateFacturaC(
  salesPoint: string,
  sequence: number,
  date: Date,
): FacturaCResult {
  const vencimiento = new Date(date.getTime() + 10 * 24 * 60 * 60 * 1000);
  return {
    cae: `7${String(sequence).padStart(13, "0")}`,
    caeVencimiento: isoDate(vencimiento),
    numeroComprobante: sequence,
    numeroFactura: `DEMO-${formatNumeroFactura(salesPoint, sequence)}`,
  };
}

// Resultado normalizado de ARCA, desacoplado de la forma SOAP del SDK.
export type VoucherEmissionOutcome = {
  approved: boolean;
  cae: string;
  caeVencimiento: string; // YYYYMMDD tal como lo devuelve ARCA
  observations: string | null;
};

export interface ElectronicBilling {
  getLastVoucherNumber(ptoVta: number, cbteTipo: number): Promise<number>;
  createVoucher(request: FacturaCRequest): Promise<VoucherEmissionOutcome>;
}

export class ArcaEmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArcaEmissionError";
  }
}

export async function issueFacturaC(
  billing: ElectronicBilling,
  input: FacturaCInput,
): Promise<FacturaCResult> {
  const last = await billing.getLastVoucherNumber(
    salesPointToNumber(input.salesPoint),
    CBTE_TIPO_FACTURA_C,
  );

  const request = buildFacturaCRequest(input, last);
  const outcome = await billing.createVoucher(request);

  if (!outcome.approved || !outcome.cae) {
    throw new ArcaEmissionError(
      outcome.observations ?? "ARCA rechazó el comprobante.",
    );
  }

  return {
    cae: outcome.cae,
    caeVencimiento: parseArcaDate(outcome.caeVencimiento),
    numeroComprobante: request.CbteDesde,
    numeroFactura: formatNumeroFactura(input.salesPoint, request.CbteDesde),
  };
}

export type ArcaCredentials = {
  cuit: string;
  certPem: string;
  keyPem: string;
  environment: ArcaEnvironment;
};

// Recorre la respuesta SOAP de ARCA juntando los textos de Observaciones/Errores
// (cada uno expone un campo Msg). Defensivo porque la forma anidada puede variar.
function extractArcaMessages(response: unknown): string | null {
  const messages: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.Msg === "string") {
      messages.push(record.Msg);
    }
    Object.values(record).forEach(visit);
  };
  visit(response);
  return messages.length > 0 ? messages.join(" ") : null;
}

// Adaptador: ÚNICO punto que toca el SDK real de @arcasdk/core.
export async function emitirFacturaC(
  credentials: ArcaCredentials,
  input: FacturaCInput,
): Promise<FacturaCResult> {
  const os = await import("node:os");
  const path = await import("node:path");
  const { Arca } = await import("@arcasdk/core");

  const arca = new Arca({
    cuit: Number(credentials.cuit.replace(/\D/g, "")),
    cert: credentials.certPem,
    key: credentials.keyPem,
    production: credentials.environment === "produccion",
    // ARCA usa TLS legacy; en Node hace falta el agente HTTPS legacy.
    useHttpsAgent: true,
    // En serverless (Vercel) solo /tmp es escribible para cachear el ticket WSAA.
    ticketPath: path.join(os.tmpdir(), "arca-tickets"),
  });

  const service = arca.electronicBillingService;

  const billing: ElectronicBilling = {
    getLastVoucherNumber: async (ptoVta, cbteTipo) => {
      const last = await service.getLastVoucher(ptoVta, cbteTipo);
      return Number(last?.cbteNro ?? 0) || 0;
    },
    createVoucher: async (request) => {
      const result = await service.createVoucher(request);
      const resultado = result.response?.FeCabResp?.Resultado;
      return {
        approved: resultado === "A",
        cae: result.cae ?? "",
        caeVencimiento: result.caeFchVto ?? "",
        observations:
          resultado === "A" ? null : extractArcaMessages(result.response),
      };
    },
  };

  return issueFacturaC(billing, input);
}
