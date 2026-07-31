"use server";

import { revalidatePath } from "next/cache";

import {
  emitirFacturaC,
  proximoNumeroComprobante,
  simulateFacturaC,
  ArcaEmissionError,
  type ArcaCredentials,
  type FacturaCResult,
} from "@/lib/arca/billing";
import { isFiscalProfileComplete } from "@/lib/arca/eligibility";
import { decidirAnteError } from "@/lib/arca/emission-outcome";
import { createSupabaseTicketStorage } from "@/lib/arca/ticket-storage";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { getCredentialSummary, loadCredentials } from "@/lib/fiscal/credentials";
import { logError } from "@/lib/log";
import { getProfile, requireUser } from "@/lib/profile";
import { isArgentina } from "@/lib/profile-countries";
import { createClient } from "@/lib/supabase/server";

export type EmitirFacturaResult =
  | { ok: true; cae: string; numeroFactura: string; vencimiento: string }
  | { ok: false; error: string };

export async function emitirFacturaAction(
  quotationId: string,
): Promise<EmitirFacturaResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    // 1) Cotización + guards.
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select("id, status, total, cae, facturado_at")
      .eq("id", quotationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (quotationError || !quotation) {
      return { ok: false, error: "No se pudo cargar la cotización." };
    }
    if (quotation.status?.trim().toLowerCase() !== "accepted") {
      return { ok: false, error: "Solo podés facturar cotizaciones aceptadas." };
    }
    if (quotation.cae || quotation.facturado_at) {
      return { ok: false, error: "Esta cotización ya tiene una factura emitida." };
    }

    // 2) País + perfil fiscal.
    const [profile, fiscal] = await Promise.all([
      getProfile(user.id),
      getFiscalProfile(user.clerkId),
    ]);

    if (!isArgentina(profile?.country ?? null)) {
      return {
        ok: false,
        error: "La facturación electrónica solo está disponible en Argentina.",
      };
    }
    if (!isFiscalProfileComplete(fiscal)) {
      return {
        ok: false,
        error: "Completá tus datos fiscales en Mi empresa antes de facturar.",
      };
    }

    // El entorno ya no lo elige el usuario: se deriva del estado del
    // certificado. Solo hay producción con un certificado verificado y
    // todavía vigente; cualquier otro caso factura en demo (simulado, sin
    // tocar ARCA). Un certificado real de producción nunca puede terminar
    // hablándole a homologación, así que ese entorno ya no es alcanzable
    // desde acá.
    const credentialSummary = await getCredentialSummary(user.clerkId);
    const certificadoVigente =
      credentialSummary?.certNotAfter != null &&
      new Date(credentialSummary.certNotAfter).getTime() > Date.now();
    const environment: "demo" | "produccion" =
      credentialSummary?.verifiedAt && certificadoVigente ? "produccion" : "demo";

    // 3) CLAIM ATÓMICO antes de emitir: reservamos la cotización marcando
    // facturado_at. Si otra pestaña/reintento concurrente ya la reservó, este
    // update afecta 0 filas y NO llamamos a ARCA — sin esto, dos requests
    // simultáneas emitían DOS facturas reales con dos CAE válidos (el guard de
    // lectura del paso 1 no cubre la ventana de carrera).
    const { data: claimed, error: claimError } = await supabase
      .from("quotations")
      .update({ facturado_at: new Date().toISOString() })
      .eq("id", quotationId)
      .eq("user_id", user.id)
      .is("cae", null)
      .is("facturado_at", null)
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      return {
        ok: false,
        error: "Esta cotización ya tiene una factura emitida o en curso.",
      };
    }

    // Libera la reserva SOLO si todavía no hay CAE (o sea, si NO se emitió).
    const releaseClaim = async () => {
      await supabase
        .from("quotations")
        .update({ facturado_at: null })
        .eq("id", quotationId)
        .eq("user_id", user.id)
        .is("cae", null);
    };

    // 4) Emisión. En modo demo simulamos (sin ARCA ni credenciales). Si no, ARCA real.
    // `yaSeLlamoAArca` distingue, ante un error, "todavía no le pedimos nada a
    // ARCA" (se libera la reserva) de "ya le pedimos que emita y no sabemos si
    // contestó" (se deja en revisión). En la rama demo nunca se toca: ahí no
    // hay ARCA.
    let yaSeLlamoAArca = false;
    let result: FacturaCResult;
    try {
      if (environment === "demo") {
        // Secuencia incremental simple para el número de comprobante simulado.
        // (neq: excluimos esta cotización, que ya tiene facturado_at por el claim.)
        const { count } = await supabase
          .from("quotations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("facturado_at", "is", null)
          .neq("id", quotationId);
        result = simulateFacturaC(fiscal!.sales_point, (count ?? 0) + 1, new Date());
      } else {
        // Credenciales cifradas.
        const credentials = await loadCredentials(user.clerkId);

        if (credentials.status !== "ok") {
          await releaseClaim();

          const mensaje =
            credentials.status === "undecryptable"
              ? "Hay un problema con la configuración de tu certificado. Escribinos y lo resolvemos."
              : credentials.status === "unavailable"
                ? "No pudimos leer tus datos fiscales en este momento. Probá de nuevo en un minuto."
                : "Todavía no cargaste tu certificado de ARCA. Configuralo en Mi empresa antes de facturar.";

          return { ok: false, error: mensaje };
        }

        const arcaCredentials: ArcaCredentials = {
          // El CUIT sale del certificado, no del formulario: es la autoridad.
          cuit: credentials.cuit,
          certPem: credentials.certPem,
          keyPem: credentials.privateKeyPem,
          environment,
          // Esta rama solo se alcanza cuando `environment` es "produccion"
          // (el "demo" se maneja arriba, sin llegar acá).
          ticketStorage: createSupabaseTicketStorage(user.clerkId, "produccion"),
        };

        // Reservamos el número ANTES de llamar. Si la respuesta de ARCA se
        // pierde, este número es lo único que nos permite preguntarle después
        // si el comprobante existe.
        const numeroReservado = await proximoNumeroComprobante(
          arcaCredentials,
          fiscal!.sales_point,
        );

        await supabase
          .from("quotations")
          .update({ cbte_nro: numeroReservado, factura_estado: "reservado" })
          .eq("id", quotationId)
          .eq("user_id", user.id);

        yaSeLlamoAArca = true;

        result = await emitirFacturaC(
          arcaCredentials,
          {
            salesPoint: fiscal!.sales_point,
            total: Number(quotation.total ?? 0),
            date: new Date(),
          },
          numeroReservado,
        );
      }
    } catch (emissionError) {
      const decision = decidirAnteError(emissionError, yaSeLlamoAArca);

      if (decision === "liberar") {
        await releaseClaim();
        throw emissionError;
      }

      // No sabemos si ARCA emitió. NO liberamos: liberar habilitaría una segunda
      // factura real sobre la misma cotización.
      await supabase
        .from("quotations")
        .update({ factura_estado: "en_revision" })
        .eq("id", quotationId)
        .eq("user_id", user.id);

      logError("facturacion.incierto", emissionError, { quotationId });

      return {
        ok: false,
        error:
          "No pudimos confirmar la emisión con ARCA. Apretá «Verificar» en la cotización para chequear si la factura salió.",
      };
    }

    // 5) Persistir el CAE. El `.is("cae", null)` hace el guardado condicional:
    // si una emisión concurrente ya escribió un CAE, no lo sobrescribimos
    // (afecta 0 filas). Mitiga la ventana de carrera del guard del paso 1.
    const { data: updated, error: updateError } = await supabase
      .from("quotations")
      .update({
        cae: result.cae,
        cae_vencimiento: result.caeVencimiento,
        numero_factura: result.numeroFactura,
        cbte_fch: result.cbteFch,
        factura_estado: "emitido",
        facturado_at: new Date().toISOString(),
      })
      .eq("id", quotationId)
      .eq("user_id", user.id)
      .is("cae", null)
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      // ARCA ya aprobó: logueamos el CAE para reconciliación manual (nunca lo
      // perdemos en silencio). Esto cubre tanto un fallo de DB como el caso raro
      // de que otra emisión concurrente ya hubiera guardado un CAE.
      console.error("[facturacion] CAE emitido pero no se pudo guardar", {
        quotationId,
        cae: result.cae,
        numeroFactura: result.numeroFactura,
        reason: updateError?.message ?? "la cotización ya tenía un CAE",
      });
      return {
        ok: false,
        error:
          "La factura se emitió pero no se pudo guardar. Anotá el CAE: " + result.cae,
      };
    }

    revalidatePath(`/cotizaciones/${quotationId}`);

    return {
      ok: true,
      cae: result.cae,
      numeroFactura: result.numeroFactura,
      vencimiento: result.caeVencimiento,
    };
  } catch (error) {
    if (error instanceof ArcaEmissionError) {
      return { ok: false, error: error.message };
    }
    console.error("[facturacion] error inesperado", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: "ARCA no está disponible en este momento. Probá más tarde.",
    };
  }
}
