import type { QuotationStatus } from "@/types";

export const DRAFT_QUOTATION_STATUS: QuotationStatus = "draft";

const QUOTATION_STATUSES = [
  DRAFT_QUOTATION_STATUS,
  "pending",
  "accepted",
  "rejected",
  "expired",
] as const;

const QUOTATION_STATUS_SET = new Set<string>(QUOTATION_STATUSES);
const LEGACY_QUOTATION_STATUS_ALIASES: Record<string, QuotationStatus> = {
  approved: "accepted",
  sent: "pending",
};

export function normalizeQuotationStatus(value: string | null) {
  const normalizedValue = value?.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  const mappedValue =
    LEGACY_QUOTATION_STATUS_ALIASES[normalizedValue] ?? normalizedValue;

  if (!QUOTATION_STATUS_SET.has(mappedValue)) {
    return null;
  }

  return mappedValue as QuotationStatus;
}

export function canHydrateQuotationEditorStatus(value: string | null) {
  const normalizedStatus = normalizeQuotationStatus(value);

  return (
    normalizedStatus === DRAFT_QUOTATION_STATUS || normalizedStatus === "pending"
  );
}

export function isDraftQuotationStatus(value: string | null) {
  return normalizeQuotationStatus(value) === DRAFT_QUOTATION_STATUS;
}

export function formatQuotationStatusLabel(value: string | null) {
  switch (normalizeQuotationStatus(value)) {
    case "draft":
      return "Borrador";
    case "pending":
      return "Enviada";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "expired":
      return "Vencida";
    default:
      return "Sin estado";
  }
}

export function getQuotationStatusBadgeClassName(value: string | null) {
  switch (normalizeQuotationStatus(value)) {
    case "accepted":
      return "border-primary/40 bg-primary/10 text-primary";
    case "rejected":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "pending":
      return "border-token bg-surface-2 text-foreground";
    case "expired":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-token bg-background text-foreground";
  }
}
