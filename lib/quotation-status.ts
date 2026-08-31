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

export type QuotationStatusFilter = "all" | QuotationStatus;

/**
 * El filtro de la lista compara contra el estado NORMALIZADO, igual que el
 * badge de la misma tarjeta. Comparar el status crudo escondía cotizaciones
 * con alias legacy ("sent" / "approved"), que se ven como "Enviada" /
 * "Aceptada" pero desaparecían al tocar ese chip.
 */
export function matchesQuotationStatusFilter(
  value: string | null,
  filter: QuotationStatusFilter,
) {
  if (filter === "all") {
    return true;
  }

  return normalizeQuotationStatus(value) === filter;
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

/**
 * Color del estado cuando se muestra como texto suelto, sin la píldora.
 * En la lista móvil las filas no llevan badge: el estado va como una línea
 * chica debajo del monto, así que solo hace falta el color del texto.
 */
export function getQuotationStatusTextClassName(value: string | null) {
  switch (normalizeQuotationStatus(value)) {
    case "accepted":
      return "text-primary";
    case "rejected":
    case "expired":
      return "text-destructive";
    default:
      return "text-muted-foreground";
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
