"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildBusinessProfileUpsertInput,
  buildOnboardingProfileUpsertInput,
  getCurrentUser,
} from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

function getRequiredValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export async function saveOnboarding(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const businessName = getRequiredValue(formData, "business_name");
  const industry = getRequiredValue(formData, "industry");
  const currency = getRequiredValue(formData, "currency");

  if (!businessName || !industry || !currency) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      buildOnboardingProfileUpsertInput({
        userId: user.id,
        businessName,
        industry,
        phone: getOptionalValue(formData, "phone"),
        email: getOptionalValue(formData, "email"),
        fallbackEmail: user.email ?? null,
        address: getOptionalValue(formData, "address"),
        currency,
      }),
      {
        onConflict: "id",
      },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("No se pudo guardar el onboarding.");
  }

  redirect("/dashboard");
}

export async function saveBusinessProfileAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const businessName = getRequiredValue(formData, "business_name");
  const industry = getRequiredValue(formData, "industry");
  const currency = getRequiredValue(formData, "currency");

  if (!businessName || !industry || !currency) {
    throw new Error("Completa el nombre del negocio, rubro y moneda antes de guardar.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      buildBusinessProfileUpsertInput({
        userId: user.id,
        businessName,
        industry,
        phone: getOptionalValue(formData, "phone"),
        email: getOptionalValue(formData, "email"),
        fallbackEmail: user.email ?? null,
        address: getOptionalValue(formData, "address"),
        currency,
        taxId: getOptionalValue(formData, "tax_id"),
        pdfFooter: getOptionalValue(formData, "pdf_footer"),
        logoPath: undefined,
      }),
      {
        onConflict: "id",
      },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("No se pudo guardar el perfil de empresa.");
  }

  revalidatePath("/perfil-empresa");
  revalidatePath("/dashboard");
  revalidatePath("/cotizaciones");
  revalidatePath("/cotizaciones/nueva");

  redirect("/perfil-empresa?saved=1");
}
