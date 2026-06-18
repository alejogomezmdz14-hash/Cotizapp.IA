"use server";

import { revalidatePath } from "next/cache";

import { emitirFacturaC, ArcaEmissionError } from "@/lib/arca/billing";
import { isFiscalProfileComplete } from "@/lib/arca/eligibility";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { getProfile, requireUser } from "@/lib/profile";
import { isArgentina } from "@/lib/profile-countries";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { downloadFile } from "@/lib/storage/server";
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

    const environment =
      (fiscal as { environment?: string }).environment === "produccion"
        ? "produccion"
        : "homologacion";

    // 3) Credenciales.
    let certPem: string;
    let keyPem: string;
    try {
      const [cert, key] = await Promise.all([
        downloadFile(STORAGE_BUCKETS.fiscal, `${user.clerkId}/cert.crt`),
        downloadFile(STORAGE_BUCKETS.fiscal, `${user.clerkId}/private.key`),
      ]);
      certPem = Buffer.from(cert.bytes).toString("utf8");
      keyPem = Buffer.from(key.bytes).toString("utf8");
    } catch {
      return {
        ok: false,
        error:
          "No pudimos leer tu certificado ARCA. Revisá que esté cargado y sea válido.",
      };
    }

    // 4) Emisión.
    const result = await emitirFacturaC(
      {
        cuit: fiscal!.cuit,
        certPem,
        keyPem,
        environment,
      },
      {
        salesPoint: fiscal!.sales_point,
        total: Number(quotation.total ?? 0),
        date: new Date(),
      },
    );

    // 5) Persistir el CAE. El `.is("cae", null)` hace el guardado condicional:
    // si una emisión concurrente ya escribió un CAE, no lo sobrescribimos
    // (afecta 0 filas). Mitiga la ventana de carrera del guard del paso 1.
    const { data: updated, error: updateError } = await supabase
      .from("quotations")
      .update({
        cae: result.cae,
        cae_vencimiento: result.caeVencimiento,
        numero_factura: result.numeroFactura,
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
