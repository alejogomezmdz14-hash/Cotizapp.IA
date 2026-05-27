export const EXPENSE_CURRENCIES = [
  { code: "ARS", label: "Peso argentino" },
  { code: "USD", label: "Dólar estadounidense" },
  { code: "MXN", label: "Peso mexicano" },
  { code: "COP", label: "Peso colombiano" },
  { code: "CLP", label: "Peso chileno" },
  { code: "BRL", label: "Real brasileño" },
  { code: "UYU", label: "Peso uruguayo" },
  { code: "PEN", label: "Sol peruano" },
  { code: "BOB", label: "Boliviano" },
  { code: "PYG", label: "Guaraní paraguayo" },
  { code: "VES", label: "Bolívar venezolano" },
] as const;

export type ExpenseCurrencyCode = (typeof EXPENSE_CURRENCIES)[number]["code"];

const EXPENSE_CURRENCY_CODES = new Set(
  EXPENSE_CURRENCIES.map((item) => item.code),
);

export function isExpenseCurrencyCode(
  value: string,
): value is ExpenseCurrencyCode {
  return EXPENSE_CURRENCY_CODES.has(value.trim().toUpperCase() as ExpenseCurrencyCode);
}

export function normalizeExpenseCurrency(
  value: string | null | undefined,
  fallback = "ARS",
) {
  const normalized = value?.trim().toUpperCase() ?? "";

  if (isExpenseCurrencyCode(normalized)) {
    return normalized;
  }

  if (isExpenseCurrencyCode(fallback)) {
    return fallback;
  }

  return "ARS";
}

export function getExpenseCurrencyLabel(code: string) {
  const normalized = normalizeExpenseCurrency(code);
  return (
    EXPENSE_CURRENCIES.find((item) => item.code === normalized)?.label ?? normalized
  );
}
