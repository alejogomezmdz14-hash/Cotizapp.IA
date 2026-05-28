import { normalizeDateOnlyString } from "@/lib/quotation-validity";

function getUtcDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isQuotationPastValidity(validUntil: string | null | undefined) {
  const normalizedDate = normalizeDateOnlyString(validUntil);

  if (!normalizedDate) {
    return false;
  }

  return normalizedDate < getUtcDateOnly(new Date());
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
  const validUntil = new Date(
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate() + 30,
    ),
  );
  return getUtcDateOnly(validUntil);
}
