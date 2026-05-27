import { formatDateOnly } from "@/lib/formatting";
import { normalizeQuotationStatus } from "@/lib/quotation-status";

type QuotationStatusHistoryInput = {
  status: string | null;
  created_at: string;
  sent_at: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
};

type StatusHistoryEvent = {
  label: string;
  at: string | null;
};

export function buildQuotationStatusHistory(
  quotation: QuotationStatusHistoryInput,
): StatusHistoryEvent[] {
  const status = normalizeQuotationStatus(quotation.status);
  const events: StatusHistoryEvent[] = [
    {
      label: "Creada",
      at: quotation.created_at,
    },
  ];

  if (quotation.sent_at && status !== "draft") {
    events.push({
      label: "Enviada",
      at: quotation.sent_at,
    });
  }

  if (status === "accepted") {
    events.push({
      label: "Aceptada",
      at: quotation.accepted_at ?? null,
    });
  }

  if (status === "rejected") {
    events.push({
      label: "Rechazada",
      at: quotation.rejected_at ?? null,
    });
  }

  return events;
}

export function formatQuotationStatusHistoryLine(
  events: StatusHistoryEvent[],
) {
  if (events.length === 0) {
    return "Sin historial de estado.";
  }

  return events
    .map((event) => {
      if (event.at) {
        return `${event.label} el ${formatDateOnly(event.at)}`;
      }

      return event.label;
    })
    .join(" → ");
}
