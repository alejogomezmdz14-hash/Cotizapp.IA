// Emisión de Factura C contra ARCA (ex-AFIP). El SDK @arcasdk/core solo se toca
// en `emitirFacturaC` (adaptador); el resto es puro/testeable vía la interfaz
// ElectronicBilling.
//
// API real confirmada en node_modules/@arcasdk/core@1.3.1:
//   new Arca({ cuit: number, cert, key, production?, useHttpsAgent?, ticketStorage? })
//   arca.electronicBillingService.getLastVoucher(salesPoint, type) -> { cbteNro, ... }
//   arca.electronicBillingService.createVoucher(req: IVoucher)
//     -> { cae, caeFchVto (YYYYMMDD), response: { FeCabResp: { Resultado } } }
//   IVoucher exige CondicionIVAReceptorId (Consumidor Final = 5).

import type { ITicketStoragePort } from "@arcasdk/core";

import { getArgentinaToday } from "@/lib/argentina-time";

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
  cbteFch: string; // ISO date YYYY-MM-DD, la fecha informada a ARCA (horario argentino)
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCbteFch(date: Date): string {
  // Horario argentino, no UTC: Vercel corre en UTC y después de las 21:00 ART
  // el día ya cambió allá, así que la factura saldría fechada mañana.
  return getArgentinaToday(date).replace(/-/g, "");
}

function salesPointToNumber(salesPoint: string): number {
  return Number(salesPoint.replace(/\D/g, "")) || 0;
}

// Arma la request para un número de comprobante ya decidido. Separado de
// `buildFacturaCRequest` para que `issueFacturaC` pueda usar un número
// reservado de antemano sin pasar por la aritmética "reservado - 1 = last".
function buildFacturaCRequestForNumber(
  input: FacturaCInput,
  numero: number,
): FacturaCRequest {
  const total = round2(input.total);

  return {
    CantReg: 1,
    PtoVta: salesPointToNumber(input.salesPoint),
    CbteTipo: CBTE_TIPO_FACTURA_C,
    Concepto: CONCEPTO_PRODUCTOS,
    DocTipo: DOC_TIPO_CONSUMIDOR_FINAL,
    DocNro: 0,
    CbteDesde: numero,
    CbteHasta: numero,
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

export function buildFacturaCRequest(
  input: FacturaCInput,
  lastVoucherNumber: number,
): FacturaCRequest {
  return buildFacturaCRequestForNumber(input, lastVoucherNumber + 1);
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

// Horario argentino, igual que `formatCbteFch`. Acá solo alimenta el
// vencimiento de un CAE simulado, así que no tiene consecuencia fiscal — pero
// dejar la única función de fecha del módulo calculando en UTC es una trampa
// para el próximo que la reutilice para algo que sí la tenga.
function isoDate(date: Date): string {
  return getArgentinaToday(date);
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
    // Antes: un CAE de 14 dígitos empezando en 7, indistinguible en forma de
    // uno real. Con el prefijo `DEMO-` queda imposible de confundir, incluso
    // si algún día se guarda en la misma columna que un CAE real.
    cae: `DEMO-${String(sequence).padStart(8, "0")}`,
    caeVencimiento: isoDate(vencimiento),
    numeroComprobante: sequence,
    numeroFactura: `DEMO-${formatNumeroFactura(salesPoint, sequence)}`,
    cbteFch: getArgentinaToday(date),
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
  // Si ya reservamos un número (ver `proximoNumeroComprobante`), se usa
  // directo: NO volvemos a preguntarle a ARCA por el último comprobante.
  numeroReservado?: number,
): Promise<FacturaCResult> {
  const request =
    numeroReservado !== undefined
      ? buildFacturaCRequestForNumber(input, numeroReservado)
      : buildFacturaCRequest(
          input,
          await billing.getLastVoucherNumber(
            salesPointToNumber(input.salesPoint),
            CBTE_TIPO_FACTURA_C,
          ),
        );

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
    cbteFch: getArgentinaToday(input.date),
  };
}

export type ArcaCredentials = {
  cuit: string;
  certPem: string;
  keyPem: string;
  environment: ArcaEnvironment;
  /** Storage del ticket WSAA. Obligatorio: sin esto el SDK cae en su
   * FileSystemTicketStorage, que indexa por CUIT en un /tmp compartido. */
  ticketStorage: ITicketStoragePort;
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
  // Número ya reservado con `proximoNumeroComprobante`, si lo hay.
  numeroReservado?: number,
): Promise<FacturaCResult> {
  const { Arca } = await import("@arcasdk/core");

  const arca = new Arca({
    cuit: Number(credentials.cuit.replace(/\D/g, "")),
    cert: credentials.certPem,
    key: credentials.keyPem,
    production: credentials.environment === "produccion",
    // ARCA usa TLS legacy; en Node hace falta el agente HTTPS legacy.
    useHttpsAgent: true,
    // SIEMPRE explícito. Omitirlo no alcanza: el SDK rellena un default que
    // apunta dentro de node_modules (solo lectura en Vercel) y vuelve a elegir
    // FileSystemTicketStorage, que keyea por CUIT en un /tmp compartido.
    ticketStorage: credentials.ticketStorage,
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

  return issueFacturaC(billing, input, numeroReservado);
}

/** Pide a ARCA el próximo número disponible, sin emitir nada. */
export async function proximoNumeroComprobante(
  credentials: ArcaCredentials,
  salesPoint: string,
): Promise<number> {
  const { Arca } = await import("@arcasdk/core");

  const arca = new Arca({
    cuit: Number(credentials.cuit.replace(/\D/g, "")),
    cert: credentials.certPem,
    key: credentials.keyPem,
    production: credentials.environment === "produccion",
    useHttpsAgent: true,
    ticketStorage: credentials.ticketStorage,
  });

  const last = await arca.electronicBillingService.getLastVoucher(
    salesPointToNumber(salesPoint),
    CBTE_TIPO_FACTURA_C,
  );

  return (Number(last?.cbteNro ?? 0) || 0) + 1;
}

export type ComprobanteEnArca =
  | { existe: true; cae: string; caeVencimiento: string; cbteFch: string }
  | { existe: false };

/** Le pregunta a ARCA si un comprobante existe. Solo lectura, no emite nada. */
export async function consultarComprobante(
  credentials: ArcaCredentials,
  salesPoint: string,
  numero: number,
): Promise<ComprobanteEnArca> {
  const { Arca } = await import("@arcasdk/core");

  const arca = new Arca({
    cuit: Number(credentials.cuit.replace(/\D/g, "")),
    cert: credentials.certPem,
    key: credentials.keyPem,
    production: credentials.environment === "produccion",
    useHttpsAgent: true,
    ticketStorage: credentials.ticketStorage,
  });

  // El DTO real del SDK (VoucherInfoResultDto, en
  // node_modules/@arcasdk/core/lib/application/dto/electronic-billing.dto.d.ts,
  // que extiende VoucherInfo de electronic-billing.types.d.ts) usa camelCase
  // y no envuelve la respuesta en `data`: getVoucherInfo ya devuelve el
  // comprobante mapeado, o `null` si ARCA no lo tiene (comprobante inexistente,
  // no un error).
  const info = await arca.electronicBillingService.getVoucherInfo(
    numero,
    salesPointToNumber(salesPoint),
    CBTE_TIPO_FACTURA_C,
  );

  if (!info?.codAutorizacion) {
    return { existe: false };
  }

  return {
    existe: true,
    cae: String(info.codAutorizacion),
    caeVencimiento: parseArcaDate(String(info.fchVto ?? "")),
    cbteFch: parseArcaDate(String(info.cbteFch ?? "")),
  };
}
