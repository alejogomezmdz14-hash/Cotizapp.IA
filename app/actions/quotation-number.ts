"use server";

import { buildQuotationNumberFromSettings, normalizeQuotationNumberingMode, normalizeQuotationPrefix } from "@/lib/quotation-numbering";
import { getProfile, requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export async function reserveNextQuotationNumber() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const mode = normalizeQuotationNumberingMode(profile?.quotation_numbering_mode);
  const prefix = normalizeQuotationPrefix(profile?.quotation_prefix);

  if (mode === "auto") {
    return buildQuotationNumberFromSettings({
      mode,
      prefix,
      counter: Math.max(1, profile?.quotation_counter ?? 1),
    });
  }

  const supabase = await createClient();

  // Reserva ATÓMICA del contador vía RPC (evita números duplicados cuando dos
  // creaciones corren a la vez). FAIL-OPEN: si el RPC todavía no existe
  // (migración 20260626_audit_fixes.sql sin aplicar), caemos al camino viejo.
  const { data: reservedCounter, error: rpcError } = await supabase.rpc(
    "reserve_quotation_counter",
    { profile_id: user.id },
  );

  if (!rpcError && typeof reservedCounter === "number" && reservedCounter > 0) {
    return buildQuotationNumberFromSettings({
      mode,
      prefix,
      counter: reservedCounter,
    });
  }

  // Fallback legacy (no atómico): leer + escribir. Al menos verificamos que la
  // escritura no falle en silencio (si falla, el contador no avanzaba y el
  // próximo número salía repetido).
  const counter = Math.max(1, profile?.quotation_counter ?? 1);
  const number = buildQuotationNumberFromSettings({
    mode,
    prefix,
    counter,
  });

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ quotation_counter: counter + 1 })
    .eq("id", user.id);

  if (updateError) {
    console.error("[quotation-number] no se pudo avanzar el contador", {
      userId: user.id,
      reason: updateError.message,
    });
  }

  return number;
}
