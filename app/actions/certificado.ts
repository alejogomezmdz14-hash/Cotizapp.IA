"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseTicketStorage } from "@/lib/arca/ticket-storage";
import { verificarConexionArca } from "@/lib/arca/verify";
import {
  CertificateError,
  generateKeyAndCsr,
  parseCertificate,
} from "@/lib/fiscal/certificate";
import {
  attachCertificate,
  getCsr,
  loadCredentials,
  markVerified,
  savePrivateKey,
} from "@/lib/fiscal/credentials";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/profile";

const MAX_CERT_BYTES = 64 * 1024;

function fecha(iso: Date): string {
  return iso.toLocaleDateString("es-AR");
}

/** Genera la clave privada y el CSR. La clave nunca sale del servidor. */
export async function generarLlaveAction(): Promise<
  { ok: true; csrPem: string; nombreArchivo: string } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const fiscal = await getFiscalProfile(user.clerkId);

    if (!fiscal?.cuit || !fiscal.business_name) {
      return {
        ok: false,
        error: "Antes de generar la llave, completá tu CUIT y tu razón social.",
      };
    }

    const { privateKeyPem, csrPem } = generateKeyAndCsr({
      cuit: fiscal.cuit,
      businessName: fiscal.business_name,
      alias: "cotizapp",
    });

    await savePrivateKey(user.clerkId, privateKeyPem, csrPem, fiscal.cuit);

    revalidatePath("/perfil-empresa");

    return {
      ok: true,
      csrPem,
      nombreArchivo: `cotizapp-${fiscal.cuit.replace(/\D/g, "")}.csr`,
    };
  } catch (error) {
    if (error instanceof CertificateError) {
      return { ok: false, error: error.message };
    }
    logError("certificado.generar", error);
    return {
      ok: false,
      error: "No pudimos generar tu llave. Probá de nuevo en un momento.",
    };
  }
}

/**
 * Devuelve el CSR ya generado, sin crear ninguna llave nueva. A diferencia de
 * `generarLlaveAction`, esto es idempotente: sirve para el caso de "perdí el
 * archivo" sin correr el riesgo de descartar la llave que ya está guardada
 * (y con la que puede haberse tramitado un certificado real en ARCA).
 */
export async function descargarCsrAction(): Promise<
  { ok: true; csrPem: string; nombreArchivo: string } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const csrPem = await getCsr(user.clerkId);

    if (!csrPem) {
      return {
        ok: false,
        error: "Todavía no generaste tu llave. Generala primero.",
      };
    }

    const fiscal = await getFiscalProfile(user.clerkId);
    const cuitDigits = fiscal?.cuit ? fiscal.cuit.replace(/\D/g, "") : "";

    return {
      ok: true,
      csrPem,
      nombreArchivo: cuitDigits ? `cotizapp-${cuitDigits}.csr` : "cotizapp.csr",
    };
  } catch (error) {
    logError("certificado.descargarCsr", error);
    return {
      ok: false,
      error: "No pudimos recuperar tu CSR. Probá de nuevo en un momento.",
    };
  }
}

/** Asocia el .crt que el usuario bajó de ARCA. Valida de verdad antes de aceptarlo. */
export async function subirCertificadoAction(
  formData: FormData,
): Promise<{ ok: true; cuit: string; venceEl: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();

    const archivo = formData.get("cert");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { ok: false, error: "Elegí el archivo .crt que bajaste de ARCA." };
    }
    if (archivo.size > MAX_CERT_BYTES) {
      return {
        ok: false,
        error: "Ese archivo es demasiado grande para ser un certificado.",
      };
    }

    const certPem = await archivo.text();
    const parsed = await attachCertificate(user.clerkId, certPem);

    revalidatePath("/perfil-empresa");

    return { ok: true, cuit: parsed.cuit, venceEl: fecha(parsed.notAfter) };
  } catch (error) {
    if (error instanceof CertificateError) {
      return { ok: false, error: error.message };
    }
    logError("certificado.subir", error);
    return {
      ok: false,
      error: "No pudimos guardar el certificado. Probá de nuevo en un momento.",
    };
  }
}

/**
 * Prueba la conexión real con ARCA y, solo si funciona, sella la verificación.
 * Es una llamada de solo lectura: no emite ningún comprobante.
 */
export async function verificarCertificadoAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const fiscal = await getFiscalProfile(user.clerkId);

    if (!fiscal?.sales_point) {
      return {
        ok: false,
        error: "Cargá tu punto de venta antes de verificar.",
      };
    }

    const credenciales = await loadCredentials(user.clerkId);

    if (credenciales.status !== "ok") {
      const mensaje =
        credenciales.status === "undecryptable"
          ? "Hay un problema con la configuración de tu certificado. Escribinos y lo resolvemos."
          : credenciales.status === "unavailable"
            ? "No pudimos leer tus datos en este momento. Probá de nuevo en un minuto."
            : "Todavía falta subir el certificado que bajaste de ARCA.";
      return { ok: false, error: mensaje };
    }

    const resultado = await verificarConexionArca(
      {
        cuit: credenciales.cuit,
        certPem: credenciales.certPem,
        keyPem: credenciales.privateKeyPem,
      },
      fiscal.sales_point,
      createSupabaseTicketStorage(user.clerkId, "produccion"),
    );

    if (!resultado.ok) {
      return { ok: false, error: resultado.mensaje };
    }

    // Recién acá: ARCA respondió que sí. Antes de esto el certificado era
    // material sin verificar y su CUIT no era confiable.
    const parsed = parseCertificate(credenciales.certPem);
    await markVerified(user.clerkId, parsed.certSerialNumber);

    revalidatePath("/perfil-empresa");
    revalidatePath("/cotizaciones");

    return { ok: true };
  } catch (error) {
    if (error instanceof CertificateError) {
      return { ok: false, error: error.message };
    }
    logError("certificado.verificar", error);
    return {
      ok: false,
      error: "No pudimos completar la verificación. Probá de nuevo en un momento.",
    };
  }
}
