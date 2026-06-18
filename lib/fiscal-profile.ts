import { createClient } from "@/lib/supabase/server";

export type ContributorType = "monotributista" | "responsable_inscripto";

export type FiscalProfile = {
  id: string;
  clerk_user_id: string;
  cuit: string;
  contributor_type: ContributorType;
  sales_point: string;
  business_name: string;
  cert_path: string | null;
  key_path: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const CUIT_FORMAT = /^\d{2}-\d{8}-\d$/;

export function normalizeCuit(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }

  return value.trim();
}

export function isValidCuitFormat(value: string): boolean {
  return CUIT_FORMAT.test(value.trim());
}

export function normalizeContributorType(
  value: string | null | undefined,
): ContributorType | null {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "monotributista" || normalized === "responsable_inscripto") {
    return normalized;
  }

  return null;
}

export function normalizeSalesPoint(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return digits.length >= 4 ? digits : digits.padStart(4, "0");
}

export async function getFiscalProfile(
  clerkUserId: string,
): Promise<FiscalProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    console.error("[fiscal] getFiscalProfile failed", { reason: error.message });
    return null;
  }

  return (data as FiscalProfile | null) ?? null;
}
