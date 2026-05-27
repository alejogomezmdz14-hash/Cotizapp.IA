const QUOTATION_VALIDITY_MAX_YEARS_AHEAD = 5;

type QuotationValidityReason = "invalid" | "past" | "too_far";

function parseDateOnlyValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getUtcDayStart(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatDateInputValue(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function addUtcYears(date: Date, years: number) {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCFullYear(nextDate.getUTCFullYear() + years);
  return nextDate;
}

export function validateQuotationValidityDate(
  value: string,
  options?: {
    now?: Date;
  },
): { valid: true } | { valid: false; reason: QuotationValidityReason } {
  const parsedDate = parseDateOnlyValue(value);

  if (!parsedDate) {
    return {
      valid: false,
      reason: "invalid",
    };
  }

  const today = getUtcDayStart(options?.now ?? new Date());
  const maxAllowedDate = addUtcYears(today, QUOTATION_VALIDITY_MAX_YEARS_AHEAD);

  if (parsedDate < today) {
    return {
      valid: false,
      reason: "past",
    };
  }

  if (parsedDate > maxAllowedDate) {
    return {
      valid: false,
      reason: "too_far",
    };
  }

  return {
    valid: true,
  };
}

export function sanitizeQuotationValidityDate(
  value: string | null,
  options?: {
    now?: Date;
  },
) {
  if (!value) {
    return null;
  }

  const parsedDate = parseDateOnlyValue(value);

  if (!parsedDate) {
    return null;
  }

  const maxAllowedDate = addUtcYears(
    getUtcDayStart(options?.now ?? new Date()),
    QUOTATION_VALIDITY_MAX_YEARS_AHEAD,
  );

  return parsedDate <= maxAllowedDate ? value : null;
}

export function getQuotationValidityBounds(options?: {
  now?: Date;
}) {
  const today = getUtcDayStart(options?.now ?? new Date());

  return {
    minDate: formatDateInputValue(today),
    maxDate: formatDateInputValue(
      addUtcYears(today, QUOTATION_VALIDITY_MAX_YEARS_AHEAD),
    ),
  };
}

export function getQuotationValidityPresetDate(
  daysFromNow: number,
  options?: {
    now?: Date;
  },
) {
  const today = getUtcDayStart(options?.now ?? new Date());
  return formatDateInputValue(addUtcDays(today, daysFromNow));
}
