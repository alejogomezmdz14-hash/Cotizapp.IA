"use server";

import { revalidatePath } from "next/cache";

import {
  consultarComprobante,
  formatNumeroFactura,
  type ArcaCredentials,
} from "@/lib/arca/billing";
import { createSupabaseTicketStorage } from "@/lib/arca/ticket-storage";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { loadCredentials } from "@/lib/fiscal/credentials";
import { logError } from "@/lib/log";
import { requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type VerificarFacturaResult =
  | {
      ok: true;
      emitida: true;
      cae: string;
      numeroFactura: string;
      vencimiento: string;
    }
  | { ok: true; emitida: false; mensaje: string }
  | { ok: false; error: string };

// Reconcilia una emisión que quedó "en_revision" (no sabemos si ARCA la
// aprobó). Solo lectura contra ARCA: nunca emite, solo pregunta por el número
// que ya se había reservado.
export async function verificarFacturaAction(
  quotationId: string,
): Promise<VerificarFacturaResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select("id, factura_estado, cbte_nro")
      .eq("id", quotationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (quotationError || !quotation) {
      return { ok: false, error: "No se pudo cargar la cotización." };
    }

    if (quotation.factura_estado !== "en_revision" || !quotation.cbte_nro) {
      return {
        ok: false,
        error: "No hay ninguna emisión pendiente de verificar en esta cotización.",
      };
    }

    const fiscal = await getFiscalProfile(user.clerkId);
    if (!fiscal) {
      return {
        ok: false,
        error: "Completá tus datos fiscales en Mi empresa antes de verificar.",
      };
    }

    const credentials = await loadCredentials(user.clerkId);

    if (credentials.status !== "ok") {
      const mensaje =
        credentials.status === "undecryptable"
          ? "Hay un problema con la configuración de tu certificado. Escribinos y lo resolvemos."
          : credentials.status === "unavailable"
            ? "No pudimos leer tus datos fiscales en este momento. Probá de nuevo en un minuto."
            : "Todavía no cargaste tu certificado de ARCA. Configuralo en Mi empresa antes de facturar.";

      return { ok: false, error: mensaje };
    }

    const arcaCredentials: ArcaCredentials = {
      cuit: credentials.cuit,
      certPem: credentials.certPem,
      keyPem: credentials.privateKeyPem,
      environment: "produccion",
      ticketStorage: createSupabaseTicketStorage(user.clerkId, "produccion"),
    };

    let comprobante;
    try {
      comprobante = await consultarComprobante(
        arcaCredentials,
        fiscal.sales_point,
        quotation.cbte_nro,
      );
    } catch (consultaError) {
      // ARCA no respondió: dejamos todo como está (sigue "en_revision") para
      // poder reintentar la verificación más tarde.
      logError("verificarFactura.consulta", consultaError, { quotationId });
      return {
        ok: false,
        error:
          "No pudimos consultar a ARCA en este momento. Probá de nuevo en unos minutos.",
      };
    }

    if (comprobante.existe) {
      const numeroFactura = formatNumeroFactura(
        fiscal.sales_point,
        quotation.cbte_nro,
      );

      const { error: updateError } = await supabase
        .from("quotations")
        .update({
          cae: comprobante.cae,
          cae_vencimiento: comprobante.caeVencimiento,
          numero_factura: numeroFactura,
          cbte_fch: comprobante.cbteFch,
          factura_estado: "emitido",
        })
        .eq("id", quotationId)
        .eq("user_id", user.id);

      if (updateError) {
        logError("verificarFactura.guardar", updateError, { quotationId });
        return {
          ok: false,
          error:
            "ARCA confirmó la factura pero no pudimos guardarla. Anotá el CAE: " +
            comprobante.cae,
        };
      }

      revalidatePath(`/cotizaciones/${quotationId}`);

      return {
        ok: true,
        emitida: true,
        cae: comprobante.cae,
        numeroFactura,
        vencimiento: comprobante.caeVencimiento,
      };
    }

    // ARCA no tiene registrado el comprobante: la emisión nunca se concretó.
    // Liberamos el número reservado para que el usuario pueda reintentar.
    const { error: releaseError } = await supabase
      .from("quotations")
      .update({
        factura_estado: "descartado",
        facturado_at: null,
        cbte_nro: null,
      })
      .eq("id", quotationId)
      .eq("user_id", user.id);

    if (releaseError) {
      logError("verificarFactura.descartar", releaseError, { quotationId });
    }

    revalidatePath(`/cotizaciones/${quotationId}`);

    return {
      ok: true,
      emitida: false,
      mensaje: "ARCA no tiene registrada esta factura. Podés volver a intentar la emisión.",
    };
  } catch (error) {
    logError("verificarFactura.inesperado", error, { quotationId });
    return {
      ok: false,
      error: "No pudimos verificar la factura en este momento. Probá más tarde.",
    };
  }
}
