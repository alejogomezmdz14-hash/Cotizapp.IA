import { cache } from "@/lib/react-cache";
import { redirect } from "next/navigation";

import { ensureProfileForClerkUser } from "@/lib/auth/clerk-profile";
import { getClerkUserId, getSessionProfile } from "@/lib/auth/clerk-session";
import type { AppUser } from "@/lib/auth/app-user";
import { createClient } from "@/lib/supabase/server";
import { normalizeEntityName } from "@/lib/entity-normalization";
import { normalizeProfileCurrency } from "@/lib/profile-currencies";
import { normalizePdfAccentColor } from "@/lib/pdf-accent-color";
import { normalizePdfTemplate } from "@/lib/pdf-template";
import {
  isClerkUserId,
  resolveLogoStoragePath,
} from "@/lib/storage/profile-paths";
import type { HydratedQuotationBranding, Profile } from "@/types";

export {
  isClerkUserId,
  remapStoragePathOwner,
  resolveLogoStoragePath,
} from "@/lib/storage/profile-paths";

export { PROFILE_CURRENCIES, normalizeProfileCurrency } from "@/lib/profile-currencies";

type ProfileUpsertIdentity = {
  userId: string;
  clerkId: string;
};

type OnboardingProfileUpsertInput = ProfileUpsertIdentity & {
  businessName: string;
  industry: string;
  phone: string | null;
  email: string | null;
  fallbackEmail: string | null;
  address: string | null;
  currency: string;
};

type BusinessProfileUpsertInput = ProfileUpsertIdentity &
  Omit<OnboardingProfileUpsertInput, keyof ProfileUpsertIdentity> & {
    taxId?: string | null;
    pdfFooter?: string | null;
    quotationNumberingMode?: string | null;
    quotationPrefix?: string | null;
    quotationCounter?: number | null;
    logoPath?: string | null;
    logoOnboardingCompleted?: boolean;
  };

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

export async function resolveProfileUserId(userRef: string) {
  if (!isClerkUserId(userRef)) {
    return userRef;
  }

  const sessionProfile = await getSessionProfile();

  if (sessionProfile?.clerk_id === userRef) {
    return sessionProfile.id;
  }

  const { getProfileByClerkId } = await import("@/lib/auth/clerk-profile");
  const profile = await getProfileByClerkId(userRef);

  if (!profile) {
    throw new Error("No se encontró el perfil asociado a tu cuenta.");
  }

  return profile.id;
}

/** UUID del perfil para rutas de Storage (resuelve Clerk ID → UUID). */
export async function resolveAuthenticatedProfileUserId(
  user: Pick<AppUser, "id" | "clerkId">,
) {
  if (user.clerkId && isClerkUserId(user.clerkId)) {
    return resolveProfileUserId(user.clerkId);
  }

  if (isClerkUserId(user.id)) {
    return resolveProfileUserId(user.id);
  }

  return user.id;
}

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const profile = await getSessionProfile();

  if (!profile) {
    return null;
  }

  const userId = await getClerkUserId();

  if (!userId) {
    return null;
  }

  return {
    id: profile.id,
    clerkId: userId,
    email: profile.email ?? null,
  };
});

export const requireUser = cache(async (): Promise<AppUser> => {
  const userId = await getClerkUserId();

  if (!userId) {
    redirect("/sign-in");
  }

  const profile = await ensureProfileForClerkUser(userId);

  return {
    id: profile.id,
    clerkId: userId,
    email: profile.email ?? null,
  };
});

const PROFILE_LEGACY_COLUMNS =
  "id, clerk_id, business_name, industry, logo_url, phone, email, address, currency, theme, created_at";
const PROFILE_TAX_COLUMNS = `${PROFILE_LEGACY_COLUMNS}, tax_id`;
const PROFILE_PDF_ACCENT_COLUMNS = `${PROFILE_TAX_COLUMNS}, pdf_footer, pdf_accent_color`;
const PROFILE_PDF_COLUMNS = `${PROFILE_PDF_ACCENT_COLUMNS}, pdf_template`;
const PROFILE_NUMBERING_COLUMNS = `${PROFILE_PDF_COLUMNS}, quotation_numbering_mode, quotation_prefix, quotation_counter`;
const PROFILE_PERSONAL_COLUMNS = `${PROFILE_NUMBERING_COLUMNS}, first_name, last_name, country, city, birth_date, avatar_url, logo_onboarding_completed`;
const PROFILE_EXTENDED_COLUMNS = PROFILE_PERSONAL_COLUMNS;

const PROFILE_SELECT_FALLBACKS = [
  PROFILE_EXTENDED_COLUMNS,
  PROFILE_NUMBERING_COLUMNS,
  PROFILE_PDF_COLUMNS,
  PROFILE_PDF_ACCENT_COLUMNS,
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
  let lastError: unknown = null;

  for (const columns of PROFILE_SELECT_FALLBACKS) {
    try {
      return await fetchProfileRow(userId, columns);
    } catch (error) {
      // Cada variante puede fallar porque al esquema le falta una columna
      // (drift entre migraciones). Guardamos el último error para no tragarnos
      // un problema real de DB (permisos, conexión) como si fuera "sin perfil".
      lastError = error;
      continue;
    }
  }

  if (lastError) {
    console.error("[profile] no se pudo leer el perfil con ningún fallback", {
      reason: lastError instanceof Error ? lastError.message : "unknown",
    });
  }

  return null;
}

async function fetchProfileByUserRef(userRef: string) {
  const sessionProfile = await getSessionProfile();

  if (
    sessionProfile &&
    (sessionProfile.id === userRef || sessionProfile.clerk_id === userRef)
  ) {
    return sessionProfile;
  }

  if (isClerkUserId(userRef)) {
    const { getProfileByClerkId } = await import("@/lib/auth/clerk-profile");
    return getProfileByClerkId(userRef);
  }

  return fetchProfileWithFallback(userRef);
}

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  return fetchProfileByUserRef(userId);
});

export async function getProfileForQuotation(
  userId: string,
): Promise<Profile | null> {
  return fetchProfileByUserRef(userId);
}

export function resolveProfileBranding(
  profile: Pick<
    Profile,
    | "id"
    | "clerk_id"
    | "business_name"
    | "logo_url"
    | "phone"
    | "email"
    | "address"
    | "currency"
    | "pdf_footer"
    | "pdf_accent_color"
    | "pdf_template"
  > | null,
): HydratedQuotationBranding {
  const pdfAccentColor = normalizePdfAccentColor(profile?.pdf_accent_color);

  return {
    businessName: normalizeOptionalText(profile?.business_name),
    logoPath: resolveLogoStoragePath(profile?.logo_url ?? null, profile),
    logoUrl: null,
    phone: normalizeOptionalText(profile?.phone),
    email: normalizeOptionalText(profile?.email),
    address: normalizeOptionalText(profile?.address),
    currency: normalizeOptionalText(profile?.currency),
    pdfFooter: normalizeOptionalText(profile?.pdf_footer),
    pdfAccentColor,
    pdfTemplate: normalizePdfTemplate(profile?.pdf_template),
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
  clerkId,
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
    clerkId,
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

export function buildBusinessProfileUpsertInput({
  userId,
  clerkId,
  businessName,
  industry,
  phone,
  email,
  fallbackEmail,
  address,
  currency,
  taxId,
  pdfFooter,
  quotationNumberingMode,
  quotationPrefix,
  quotationCounter,
  logoPath,
  logoOnboardingCompleted,
}: BusinessProfileUpsertInput) {
  return {
    id: userId,
    clerk_id: clerkId,
    business_name: normalizeEntityName(businessName),
    industry: normalizeEntityName(industry),
    ...(taxId !== undefined ? { tax_id: taxId } : {}),
    ...(quotationNumberingMode !== undefined
      ? { quotation_numbering_mode: quotationNumberingMode }
      : {}),
    ...(quotationPrefix !== undefined ? { quotation_prefix: quotationPrefix } : {}),
    ...(quotationCounter !== undefined ? { quotation_counter: quotationCounter } : {}),
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
