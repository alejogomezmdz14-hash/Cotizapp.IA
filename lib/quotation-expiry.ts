import { normalizeDateOnlyString } from "@/lib/quotation-validity";

export function isQuotationPastValidity(validUntil: string | null | undefined) {
  const normalizedDate = normalizeDateOnlyString(validUntil);

  if (!normalizedDate) {
    return false;
  }

  const today = new Date();
  const todayOnly = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;

  return normalizedDate < todayOnly;
}

export function shouldDisplayQuotationAsExpired(
  validUntil: string | null | undefined,
  status: string | null | undefined,
) {
  if (isQuotationPastValidity(validUntil)) {
    return true;
  }

  return status?.trim().toLowerCase() === "expired";
}

export function getDefaultQuotationValidityDate(fromDate = new Date()) {
  const validUntil = new Date(fromDate);
  validUntil.setDate(validUntil.getDate() + 30);
  return validUntil.toISOString().slice(0, 10);
}
