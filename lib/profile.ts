import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("No se pudo cargar el perfil.");
  }

  return (data as Profile | null) ?? null;
}

export function resolveProfileBranding(
  profile: Pick<
    Profile,
    "business_name" | "logo_url" | "phone" | "email" | "address" | "currency"
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
  return {
    id: userId,
    business_name: businessName,
    industry,
    phone,
    email: email ?? fallbackEmail ?? null,
    address,
    currency,
  };
}
