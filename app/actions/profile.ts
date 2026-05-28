"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizePdfAccentColor } from "@/lib/pdf-accent-color";
import { normalizePdfTemplate } from "@/lib/pdf-template";
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

function redirectWithOnboardingError(message: string) {
  redirect(`/onboarding?error=${encodeURIComponent(message)}`);
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
    redirectWithOnboardingError(
      "Completá nombre del negocio, rubro y moneda antes de continuar.",
    );
  }

  let profilePayload: ReturnType<typeof buildOnboardingProfileUpsertInput>;

  try {
    profilePayload = buildOnboardingProfileUpsertInput({
      userId: user.id,
      businessName,
      industry,
      phone: getOptionalValue(formData, "phone"),
      email: getOptionalValue(formData, "email"),
      fallbackEmail: user.email ?? null,
      address: getOptionalValue(formData, "address"),
      currency,
    });
  } catch (validationError) {
    redirectWithOnboardingError(
      validationError instanceof Error && validationError.message.trim()
        ? validationError.message
        : "Revisá los datos del negocio antes de continuar.",
    );
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert(profilePayload, {
    onConflict: "id",
  });

  if (error) {
    redirectWithOnboardingError(
      error.message?.trim() ||
        "No se pudo guardar el onboarding. Intentá de nuevo en unos segundos.",
    );
  }

  redirect("/onboarding?step=logo");
}

export async function completeOnboardingLogoStep() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: currentProfile, error: profileError } = await supabase
    .from("profiles")
    .select("business_name, industry")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !currentProfile) {
    redirect("/onboarding");
  }

  if (!currentProfile.business_name?.trim() || !currentProfile.industry?.trim()) {
    redirect("/onboarding");
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      logo_onboarding_completed: true,
    },
    { onConflict: "id" },
  );

  if (error) {
    redirectWithOnboardingError(
      error.message?.trim() ||
        "No se pudo completar el paso del logo. Intentá de nuevo.",
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  revalidatePath("/perfil-empresa");
  revalidatePath("/cotizaciones");

  redirect("/dashboard");
}

export async function saveUserProfileAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const firstName = getRequiredValue(formData, "first_name");
  const lastName = getRequiredValue(formData, "last_name");

  if (!firstName || !lastName) {
    throw new Error("Completá tu nombre y apellido antes de guardar.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        phone: getOptionalValue(formData, "phone"),
        country: getOptionalValue(formData, "country"),
        city: getOptionalValue(formData, "city"),
        birth_date: getOptionalValue(formData, "birth_date"),
      },
      {
        onConflict: "id",
      },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("No se pudo guardar el perfil personal.");
  }

  revalidatePath("/perfil-usuario");
  revalidatePath("/dashboard");
  redirect("/perfil-usuario?saved=1");
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
        quotationNumberingMode: getRequiredValue(formData, "quotation_numbering_mode"),
        quotationPrefix: getOptionalValue(formData, "quotation_prefix"),
        quotationCounter: Number.parseInt(
          getRequiredValue(formData, "quotation_counter"),
          10,
        ),
        logoPath: undefined,
      }),
      {
        onConflict: "id",
      },
    )
    .select("id")
    .single();

  if (error || !data) {
    const details =
      error?.message?.trim() ||
      "No se pudo guardar el perfil de empresa. Verificá que la columna tax_id exista en Supabase.";
    throw new Error(details);
  }

  revalidatePath("/perfil-empresa");
  revalidatePath("/dashboard");
  revalidatePath("/cotizaciones");
  revalidatePath("/cotizaciones/nueva");

  redirect("/perfil-empresa?saved=1");
}

export async function saveAppearanceSettingsAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const theme = getRequiredValue(formData, "theme");
  const pdfAccentColor = normalizePdfAccentColor(
    getRequiredValue(formData, "pdf_accent_color"),
  );

  if (theme !== "light" && theme !== "dark") {
    throw new Error("Seleccioná un tema válido.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        theme,
        pdf_accent_color: pdfAccentColor,
      },
      { onConflict: "id" },
    );

  if (error) {
    throw new Error("No se pudieron guardar los ajustes de apariencia.");
  }

  revalidatePath("/ajustes");
  revalidatePath("/perfil-empresa");
  revalidatePath("/dashboard");
  redirect("/ajustes?saved=appearance");
}

export async function savePdfTemplateSettingsAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const pdfTemplate = normalizePdfTemplate(getRequiredValue(formData, "pdf_template"));
  const pdfAccentColor = normalizePdfAccentColor(
    getRequiredValue(formData, "pdf_accent_color"),
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        pdf_template: pdfTemplate,
        pdf_accent_color: pdfAccentColor,
      },
      { onConflict: "id" },
    );

  if (error) {
    throw new Error("No se pudo guardar la plantilla del PDF.");
  }

  revalidatePath("/perfil-empresa");
  revalidatePath("/dashboard");
  revalidatePath("/cotizaciones");
  redirect("/perfil-empresa?saved=pdf");
}

export async function deleteAccountAction() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", user.id);

  if (deleteError) {
    throw new Error("No se pudo eliminar la cuenta. Intentá de nuevo.");
  }

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
