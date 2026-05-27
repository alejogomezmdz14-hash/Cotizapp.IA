"use server";

import { buildQuotationNumberFromSettings, normalizeQuotationNumberingMode, normalizeQuotationPrefix } from "@/lib/quotation-numbering";
import { getProfile, requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export async function reserveNextQuotationNumber() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const mode = normalizeQuotationNumberingMode(profile?.quotation_numbering_mode);
  const prefix = normalizeQuotationPrefix(profile?.quotation_prefix);
  const counter = Math.max(1, profile?.quotation_counter ?? 1);

  if (mode === "auto") {
    return buildQuotationNumberFromSettings({
      mode,
      prefix,
      counter,
    });
  }

  const number = buildQuotationNumberFromSettings({
    mode,
    prefix,
    counter,
  });

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ quotation_counter: counter + 1 })
    .eq("id", user.id);

  return number;
}
