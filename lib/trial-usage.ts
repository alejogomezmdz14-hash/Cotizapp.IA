/**
 * Enforcement server-side del trial/freemium. Lee/escribe los contadores
 * monótonos de `profiles` (`trial_quotations_used`, `trial_invoice_scans_used`).
 *
 * REGLA CRÍTICA: todo acá es FAIL-OPEN. Si la migración todavía no corrió (las
 * columnas no existen) o la DB falla, nunca rompemos el flujo de crear cotización
 * ni escanear factura: leemos 0 (deja pasar) y los increments son fail-silent.
 */

import { currentUser } from "@clerk/nextjs/server";

import { isActivePlan } from "@/lib/auth/plan";
import { createClient } from "@/lib/supabase/server";

export type TrialUsage = {
  quotationsUsed: number;
  invoiceScansUsed: number;
};

const EMPTY_TRIAL_USAGE: TrialUsage = {
  quotationsUsed: 0,
  invoiceScansUsed: 0,
};

type TrialCounterColumn =
  | "trial_quotations_used"
  | "trial_invoice_scans_used";

function toCounter(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * ¿El usuario actual tiene un plan pago (ilimitado)? Se lee de
 * `currentUser().publicMetadata.plan` (más confiable que los sessionClaims).
 * FAIL-OPEN: ante cualquier error asumimos trial (`false`).
 */
export async function isCurrentUserPaid(): Promise<boolean> {
  try {
    const user = await currentUser();
    const plan = user?.publicMetadata?.plan;
    return isActivePlan(typeof plan === "string" ? plan : null);
  } catch (error) {
    console.error("[trial] no se pudo leer el plan del usuario", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

/**
 * Contadores de uso del trial para un perfil (UUID de `profiles.id`).
 * FAIL-OPEN CRÍTICO: si la columna no existe (migración sin correr) o hay
 * cualquier error, devolvemos 0/0 para dejar pasar la acción.
 */
export async function getTrialUsage(userId: string): Promise<TrialUsage> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("trial_quotations_used, trial_invoice_scans_used")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return EMPTY_TRIAL_USAGE;
    }

    const row = data as Record<string, unknown>;

    return {
      quotationsUsed: toCounter(row.trial_quotations_used),
      invoiceScansUsed: toCounter(row.trial_invoice_scans_used),
    };
  } catch (error) {
    console.error("[trial] no se pudo leer el uso del trial", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return EMPTY_TRIAL_USAGE;
  }
}

/**
 * Incrementa un contador del trial (`col = col + 1`). Sin RPC ni raw SQL bajo
 * RLS: leemos el valor actual y escribimos +1. La carrera 15→16 es tolerable
 * para el MVP. FAIL-SILENT: cualquier error se loguea y sigue (nunca throw).
 */
async function incrementTrialCounter(
  userId: string,
  column: TrialCounterColumn,
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(column)
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return;
    }

    const current = toCounter((data as Record<string, unknown>)[column]);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ [column]: current + 1 })
      .eq("id", userId);

    if (updateError) {
      console.error("[trial] no se pudo incrementar el contador", {
        column,
        reason: updateError.message,
      });
    }
  } catch (error) {
    console.error("[trial] error inesperado al incrementar el contador", {
      column,
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function incrementTrialQuotations(userId: string): Promise<void> {
  await incrementTrialCounter(userId, "trial_quotations_used");
}

export async function incrementTrialInvoiceScans(userId: string): Promise<void> {
  await incrementTrialCounter(userId, "trial_invoice_scans_used");
}
