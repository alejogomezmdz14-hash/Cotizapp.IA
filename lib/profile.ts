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
  return Boolean(
    profile?.business_name?.trim() && profile?.industry?.trim(),
  );
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

const PROFILE_BASE_COLUMNS =
  "id, business_name, industry, logo_url, phone, email, address, currency, theme, created_at";
const PROFILE_TAX_COLUMNS = `${PROFILE_BASE_COLUMNS}, tax_id`;
const PROFILE_EXTENDED_COLUMNS = `${PROFILE_TAX_COLUMNS}, pdf_footer`;

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

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    return await fetchProfileRow(userId, PROFILE_EXTENDED_COLUMNS);
  } catch {
    try {
      return await fetchProfileRow(userId, PROFILE_TAX_COLUMNS);
    } catch {
      try {
        return await fetchProfileRow(userId, PROFILE_BASE_COLUMNS);
      } catch {
        throw new Error("No se pudo cargar el perfil.");
      }
    }
  }
}

export async function getProfileForQuotation(
  userId: string,
): Promise<Profile | null> {
  try {
    return await fetchProfileRow(userId, PROFILE_EXTENDED_COLUMNS);
  } catch {
    try {
      return await fetchProfileRow(userId, PROFILE_BASE_COLUMNS);
    } catch {
      return null;
    }
  }
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
  };
}
