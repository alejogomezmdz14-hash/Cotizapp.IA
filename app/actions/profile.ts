"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/profile";
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
  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: businessName,
      industry,
      phone: getOptionalValue(formData, "phone"),
      email: getOptionalValue(formData, "email") ?? user.email ?? null,
      address: getOptionalValue(formData, "address"),
      currency,
    })
    .eq("id", user.id);

  if (error) {
    throw new Error("No se pudo guardar el onboarding.");
  }

  redirect("/dashboard");
}
