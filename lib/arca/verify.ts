import type { ITicketStoragePort } from "@arcasdk/core";

import { logError } from "@/lib/log";

// Verificación del certificado contra ARCA.
//
// Se usa `getSalesPoints()`, que es de SOLO LECTURA: no emite ningún comprobante.
// Corre contra PRODUCCIÓN porque un certificado de producción no sirve en
// homologación (homologación usa certificados propios sacados por WSASS), así
// que "probar en homologación" no es una opción.
//
// Una sola llamada valida las tres cosas que pueden estar mal después del
// trámite: que el certificado sea válido, que el web service esté delegado, y
// que el punto de venta exista y esté habilitado para Web Services. Los dos
// últimos son los pasos que todo el mundo se saltea.

export type MotivoFallo =
  | "sin-delegacion"
  | "punto-de-venta"
  | "certificado"
  | "arca-caida"
  | "desconocido";

export type VerificacionResultado =
  | { ok: true; puntosDeVenta: number[] }
  | { ok: false; motivo: MotivoFallo; mensaje: string };

function textoDelError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

/**
 * Traduce lo que devuelve ARCA a una instrucción que el usuario pueda seguir.
 * Nunca devuelve el texto crudo: los mensajes de ARCA vienen con prefijos SOAP y
 * a veces con trazas internas.
 */
export function traducirErrorArca(
  error: unknown,
  salesPoint: string,
): { motivo: MotivoFallo; mensaje: string } {
  const texto = textoDelError(error).toLowerCase();

  if (
    texto.includes("no se encuentra autorizado") ||
    texto.includes("cert.untrusted") ||
    texto.includes("cee no se encuentra") ||
    texto.includes("no autorizado a acceder")
  ) {
    return {
      motivo: "sin-delegacion",
      mensaje:
        "Falta autorizar a Cotizapp en ARCA. Entrá con tu Clave Fiscal a Administrador de Relaciones y delegá el servicio de Facturación Electrónica al certificado que generaste.",
    };
  }

  if (
    texto.includes("punto de venta") ||
    texto.includes("punto_de_venta") ||
    texto.includes("ptovta")
  ) {
    return {
      motivo: "punto-de-venta",
      mensaje: `El punto de venta ${salesPoint} no existe o no está habilitado para Web Services en ARCA. Crealo desde Regímenes de Facturación y Registración, eligiendo el tipo "Web Services".`,
    };
  }

  if (
    texto.includes("certificado") ||
    texto.includes("expirado") ||
    texto.includes("cms") ||
    texto.includes("firma")
  ) {
    return {
      motivo: "certificado",
      mensaje:
        "ARCA no aceptó tu certificado. Puede estar vencido o no ser el que corresponde a la llave que generamos. Generá uno nuevo y rehacé el trámite.",
    };
  }

  if (
    texto.includes("etimedout") ||
    texto.includes("econnreset") ||
    texto.includes("socket hang up") ||
    texto.includes("enotfound") ||
    texto.includes("network")
  ) {
    return {
      motivo: "arca-caida",
      mensaje:
        "ARCA no está respondiendo en este momento. No es un problema de tus datos: probá de nuevo en unos minutos.",
    };
  }

  return {
    motivo: "desconocido",
    mensaje:
      "No pudimos verificar tu certificado con ARCA. Revisá que hayas completado los tres pasos del trámite y probá de nuevo.",
  };
}

export async function verificarConexionArca(
  credentials: { cuit: string; certPem: string; keyPem: string },
  salesPoint: string,
  ticketStorage: ITicketStoragePort,
): Promise<VerificacionResultado> {
  try {
    const { Arca } = await import("@arcasdk/core");

    const arca = new Arca({
      cuit: Number(credentials.cuit.replace(/\D/g, "")),
      cert: credentials.certPem,
      key: credentials.keyPem,
      production: true,
      useHttpsAgent: true,
      ticketStorage,
    });

    const respuesta = await arca.electronicBillingService.getSalesPoints();

    // La forma exacta de la respuesta varía; nos interesa la lista de números.
    const crudos = (respuesta as { data?: unknown })?.data ?? respuesta;
    const lista = Array.isArray(crudos) ? crudos : [];
    const puntosDeVenta = lista
      .map((item) => Number((item as { Nro?: unknown })?.Nro ?? NaN))
      .filter((n) => Number.isFinite(n));

    const buscado = Number(salesPoint.replace(/\D/g, ""));
    if (puntosDeVenta.length > 0 && !puntosDeVenta.includes(buscado)) {
      return {
        ok: false,
        motivo: "punto-de-venta",
        mensaje: `Tu certificado funciona, pero el punto de venta ${salesPoint} no figura entre los habilitados para Web Services en ARCA. Los que tenés habilitados son: ${puntosDeVenta.join(", ")}.`,
      };
    }

    return { ok: true, puntosDeVenta };
  } catch (error) {
    logError("arca.verificar", error);
    const { motivo, mensaje } = traducirErrorArca(error, salesPoint);
    return { ok: false, motivo, mensaje };
  }
}
