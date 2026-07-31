"use server";

import { revalidatePath } from "next/cache";

import {
  isValidCuitFormat,
  normalizeContributorType,
  normalizeCuit,
  normalizeSalesPoint,
} from "@/lib/fiscal-profile";
import { requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveFiscalProfileAction(formData: FormData) {
  const user = await requireUser();

  const cuit = normalizeCuit(readText(formData, "cuit"));
  const contributorType = normalizeContributorType(
    readText(formData, "contributor_type"),
  );
  const salesPoint = normalizeSalesPoint(readText(formData, "sales_point"));
  const businessName = readText(formData, "business_name");

  if (!isValidCuitFormat(cuit)) {
    throw new Error("El CUIT debe tener el formato XX-XXXXXXXX-X.");
  }
  if (!contributorType) {
    throw new Error("Elegí un tipo de contribuyente válido.");
  }
  if (!salesPoint) {
    throw new Error("Ingresá el punto de venta.");
  }
  if (!businessName) {
    throw new Error("Ingresá la razón social.");
  }

  const supabase = await createClient();

  const { error: upsertError } = await supabase.from("fiscal_profiles").upsert(
    {
      clerk_user_id: user.clerkId,
      cuit,
      contributor_type: contributorType,
      sales_point: salesPoint,
      business_name: businessName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id" },
  );

  if (upsertError) {
    console.error("[fiscal] upsert failed", { reason: upsertError.message });
    throw new Error("No se pudieron guardar los datos fiscales.");
  }

  revalidatePath("/perfil-empresa");
}
