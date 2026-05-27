import { normalizeDateOnlyString } from "@/lib/quotation-validity";

const DEFAULT_CURRENCY = "MXN";

function getCurrencyCode(currency: string | null) {
  const normalizedCurrency = currency?.trim().toUpperCase();

  if (normalizedCurrency && /^[A-Z]{3}$/.test(normalizedCurrency)) {
    return normalizedCurrency;
  }

  return DEFAULT_CURRENCY;
}

export function formatCurrencyAmount(
  value: number | null | undefined,
  currency: string | null,
) {
  const amount = value ?? 0;
  const currencyCode = getCurrencyCode(currency);

  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: DEFAULT_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

export function formatPercentage(value: number | null | undefined) {
  const amount = value ?? 0;

  if (!Number.isFinite(amount)) {
    return "0%";
  }

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)}%`;
}

export function formatDateOnly(value: string | null) {
  const normalizedValue = normalizeDateOnlyString(value);

  if (!normalizedValue) {
    return "Sin fecha";
  }

  const [year, month, day] = normalizedValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
