import { normalizeDateOnlyString } from "@/lib/quotation-validity";

const DEFAULT_CURRENCY = "ARS";

function capitalizeMonthToken(value: string) {
  const normalizedValue = value.replace(/\./g, "").trim();

  if (!normalizedValue) {
    return value;
  }

  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
}

function formatDateWithCapitalizedMonth(
  date: Date,
  options: Intl.DateTimeFormatOptions,
) {
  const formatter = new Intl.DateTimeFormat("es-AR", options);

  return formatter
    .formatToParts(date)
    .map((part) =>
      part.type === "month" ? capitalizeMonthToken(part.value) : part.value,
    )
    .join("");
}

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
  const formattedAmount = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formattedAmount} ${currencyCode}`;
}

export function formatExpenseAmount(
  value: number | null | undefined,
  currency: string | null,
) {
  const amount = value ?? 0;
  const currencyCode = getCurrencyCode(currency);
  const formattedAmount = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formattedAmount} ${currencyCode}`;
}

type ExpenseCurrencyTotalInput = {
  currency: string;
  total: number;
};

export function formatExpenseTotalsByCurrency(
  totals: ExpenseCurrencyTotalInput[],
) {
  if (totals.length === 0) {
    return formatExpenseAmount(0, "ARS");
  }

  return totals
    .map((item) => formatExpenseAmount(item.total, item.currency))
    .join(" + ");
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

  return formatDateWithCapitalizedMonth(date, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return formatDateWithCapitalizedMonth(date, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  if (!year || !month) {
    return monthKey;
  }

  const date = new Date(Date.UTC(year, month - 1, 1));
  return formatDateWithCapitalizedMonth(date, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthShortLabel(date: Date) {
  return formatDateWithCapitalizedMonth(date, {
    month: "short",
    year: "2-digit",
  });
}
