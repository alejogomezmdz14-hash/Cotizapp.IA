import { buildQuotationNumber } from "@/lib/quotations";

export type QuotationNumberingMode = "auto" | "sequential" | "custom";

export function normalizeQuotationNumberingMode(
  value: string | null | undefined,
): QuotationNumberingMode {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "sequential" || normalized === "custom") {
    return normalized;
  }

  return "auto";
}

export function normalizeQuotationPrefix(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");

  if (!normalized) {
    return "COT";
  }

  return normalized.endsWith("-") ? normalized : `${normalized}-`;
}

export function formatSequentialQuotationNumber(prefix: string, counter: number) {
  const normalizedPrefix = normalizeQuotationPrefix(prefix);
  return `${normalizedPrefix}${String(Math.max(1, counter)).padStart(3, "0")}`;
}

export function buildQuotationNumberFromSettings(input: {
  mode: QuotationNumberingMode;
  prefix: string | null;
  counter: number;
  date?: Date;
}) {
  const mode = input.mode;

  if (mode === "sequential" || mode === "custom") {
    return formatSequentialQuotationNumber(input.prefix ?? "COT", input.counter);
  }

  return buildQuotationNumber(input.date);
}
