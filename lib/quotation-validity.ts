const QUOTATION_VALIDITY_MAX_YEARS_AHEAD = 5;
const MIN_VALID_YEAR = 2000;
const MAX_VALID_YEAR = 2100;

type QuotationValidityReason = "invalid" | "past" | "too_far";

function parseDateOnlyValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < MIN_VALID_YEAR || year > MAX_VALID_YEAR) {
    return null;
  }

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

export function formatDateInputValue(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDateInputHint(value: string) {
  const normalizedValue = normalizeDateOnlyString(value);

  if (!normalizedValue) {
    return value;
  }

  const [year, month, day] = normalizedValue.split("-");
  return `${day}/${month}/${year}`;
}

export function normalizeDateOnlyString(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = String(value).trim();

  if (!trimmedValue) {
    return null;
  }

  const isoDatePrefixMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(
    trimmedValue,
  );

  if (isoDatePrefixMatch) {
    const candidate = `${isoDatePrefixMatch[1]}-${isoDatePrefixMatch[2]}-${isoDatePrefixMatch[3]}`;
    return parseDateOnlyValue(candidate) ? candidate : null;
  }

  const compactDateMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmedValue);

  if (compactDateMatch) {
    const candidate = `${compactDateMatch[1]}-${compactDateMatch[2]}-${compactDateMatch[3]}`;
    return parseDateOnlyValue(candidate) ? candidate : null;
  }

  if (/^\d+$/.test(trimmedValue)) {
    const numericValue = Number(trimmedValue);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    const timestamp =
      trimmedValue.length <= 10 ? numericValue * 1000 : numericValue;
    const parsedDate = new Date(timestamp);

    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return formatDateInputValue(getUtcDayStart(parsedDate));
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const candidate = formatDateInputValue(getUtcDayStart(parsedDate));
  return parseDateOnlyValue(candidate) ? candidate : null;
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
  const normalizedValue = normalizeDateOnlyString(value);

  if (!normalizedValue) {
    return {
      valid: false,
      reason: "invalid",
    };
  }

  const parsedDate = parseDateOnlyValue(normalizedValue);

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
  const normalizedValue = normalizeDateOnlyString(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedDate = parseDateOnlyValue(normalizedValue);

  if (!parsedDate) {
    return null;
  }

  const maxAllowedDate = addUtcYears(
    getUtcDayStart(options?.now ?? new Date()),
    QUOTATION_VALIDITY_MAX_YEARS_AHEAD,
  );

  return parsedDate <= maxAllowedDate ? normalizedValue : null;
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
