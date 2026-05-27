import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { normalizeEntityName } from "@/lib/entity-normalization";
import type { HydratedQuotationBranding, Profile } from "@/types";

type OnboardingProfileUpsertInput = {
  userId: string;
  businessName: string;
  industry: string;
  phone: string | null;
  email: string | null;
  fallbackEmail: string | null;
  address: string | null;
  currency: string;
};

type BusinessProfileUpsertInput = OnboardingProfileUpsertInput & {
  taxId?: string | null;
  pdfFooter?: string | null;
  logoPath?: string | null;
  logoOnboardingCompleted?: boolean;
};

const SUPPORTED_PROFILE_CURRENCIES = new Set([
  "ARS",
  "USD",
  "EUR",
  "MXN",
  "COP",
  "CLP",
  "BRL",
  "UYU",
]);

export function isProfileComplete(profile: Profile | null) {
  const hasBusinessBasics = Boolean(
    profile?.business_name?.trim() && profile?.industry?.trim(),
  );

  if (!hasBusinessBasics) {
    return false;
  }

  if (typeof profile?.logo_onboarding_completed === "boolean") {
    return profile.logo_onboarding_completed;
  }

  // Esquemas legacy sin la columna: no bloquear usuarios existentes.
  return true;
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

const PROFILE_LEGACY_COLUMNS =
  "id, business_name, industry, logo_url, phone, email, address, currency, theme, created_at";
const PROFILE_TAX_COLUMNS = `${PROFILE_LEGACY_COLUMNS}, tax_id`;
const PROFILE_PDF_COLUMNS = `${PROFILE_TAX_COLUMNS}, pdf_footer`;
const PROFILE_PERSONAL_COLUMNS = `${PROFILE_PDF_COLUMNS}, first_name, last_name, country, city, birth_date, avatar_url, logo_onboarding_completed`;
const PROFILE_EXTENDED_COLUMNS = PROFILE_PERSONAL_COLUMNS;

const PROFILE_SELECT_FALLBACKS = [
  PROFILE_EXTENDED_COLUMNS,
  PROFILE_PDF_COLUMNS,
  PROFILE_TAX_COLUMNS,
  PROFILE_LEGACY_COLUMNS,
] as const;

async function fetchProfileRow(
  userId: string,
  columns: string,
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Profile | null) ?? null;
}

async function fetchProfileWithFallback(userId: string) {
  for (const columns of PROFILE_SELECT_FALLBACKS) {
    try {
      return await fetchProfileRow(userId, columns);
    } catch {
      continue;
    }
  }

  return null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const profile = await fetchProfileWithFallback(userId);

  if (!profile) {
    throw new Error("No se pudo cargar el perfil.");
  }

  return profile;
}

export async function getProfileForQuotation(
  userId: string,
): Promise<Profile | null> {
  return fetchProfileWithFallback(userId);
}

export function resolveProfileBranding(
  profile: Pick<
    Profile,
    | "business_name"
    | "logo_url"
    | "phone"
    | "email"
    | "address"
    | "currency"
    | "pdf_footer"
  > | null,
): HydratedQuotationBranding {
  return {
    businessName: normalizeOptionalText(profile?.business_name),
    logoPath: normalizeOptionalText(profile?.logo_url),
    logoUrl: null,
    phone: normalizeOptionalText(profile?.phone),
    email: normalizeOptionalText(profile?.email),
    address: normalizeOptionalText(profile?.address),
    currency: normalizeOptionalText(profile?.currency),
    pdfFooter: normalizeOptionalText(profile?.pdf_footer),
  };
}

function isPdfEmbeddableLogoContentType(contentType: string | null) {
  const normalizedType = contentType?.trim().toLowerCase();

  return normalizedType === "image/png" || normalizedType === "image/jpeg";
}

export function buildProfileLogoDataUrl(file: {
  bytes: Uint8Array;
  contentType: string | null;
} | null) {
  if (!file || !isPdfEmbeddableLogoContentType(file.contentType)) {
    return null;
  }

  return `data:${file.contentType};base64,${Buffer.from(file.bytes).toString(
    "base64",
  )}`;
}

export function buildOnboardingProfileUpsertInput({
  userId,
  businessName,
  industry,
  phone,
  email,
  fallbackEmail,
  address,
  currency,
}: OnboardingProfileUpsertInput) {
  return buildBusinessProfileUpsertInput({
    userId,
    businessName,
    industry,
    phone,
    email,
    fallbackEmail,
    address,
    currency,
    pdfFooter: undefined,
    logoPath: undefined,
    // Omitimos el estado de onboarding del logo para no sobrescribir
    // un logo ya completado por el usuario (o su carga previa).
    logoOnboardingCompleted: undefined,
  });
}

export function normalizeProfileCurrency(currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase();

  if (!SUPPORTED_PROFILE_CURRENCIES.has(normalizedCurrency)) {
    throw new Error("Selecciona una moneda válida para el perfil.");
  }

  return normalizedCurrency;
}

export function buildBusinessProfileUpsertInput({
  userId,
  businessName,
  industry,
  phone,
  email,
  fallbackEmail,
  address,
  currency,
  taxId,
  pdfFooter,
  logoPath,
  logoOnboardingCompleted,
}: BusinessProfileUpsertInput) {
  return {
    id: userId,
    business_name: normalizeEntityName(businessName),
    industry: normalizeEntityName(industry),
    ...(taxId !== undefined ? { tax_id: taxId } : {}),
    ...(logoPath !== undefined ? { logo_url: logoPath } : {}),
    phone,
    email: email ?? fallbackEmail ?? null,
    address,
    currency: normalizeProfileCurrency(currency),
    ...(pdfFooter !== undefined ? { pdf_footer: pdfFooter } : {}),
    ...(logoOnboardingCompleted !== undefined
      ? { logo_onboarding_completed: logoOnboardingCompleted }
      : {}),
  };
}
