import { normalizeDateOnlyString } from "@/lib/quotation-validity";

const QUOTATION_TIME_ZONE = "America/Argentina/Buenos_Aires";

function getUtcDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * "Hoy" en horario de Argentina (UTC-3), como YYYY-MM-DD. Comparar contra UTC
 * marcaba cotizaciones como vencidas un día antes después de las ~21 hs locales
 * (cuando en UTC ya es el día siguiente). en-CA emite el formato YYYY-MM-DD.
 */
function getArgentinaDateOnly(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: QUOTATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isQuotationPastValidity(validUntil: string | null | undefined) {
  const normalizedDate = normalizeDateOnlyString(validUntil);

  if (!normalizedDate) {
    return false;
  }

  return normalizedDate < getArgentinaDateOnly();
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
