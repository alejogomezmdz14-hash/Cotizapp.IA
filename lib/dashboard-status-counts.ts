// lib/dashboard-status-counts.ts
import { getPeriodBoundaries, type DashboardPeriod } from "@/lib/dashboard-period";
import { normalizeQuotationStatus } from "@/lib/quotation-status";
import { createClient } from "@/lib/supabase/server";

export type QuotationStatusCounts = {
  accepted: number;
  pending: number;
  rejected: number;
  expired: number;
  draft: number;
  total: number;
};

export function emptyQuotationStatusCounts(): QuotationStatusCounts {
  return { accepted: 0, pending: 0, rejected: 0, expired: 0, draft: 0, total: 0 };
}

/** Agrupa una lista de estados crudos en conteos canónicos (aplica alias). */
export function bucketQuotationStatusCounts(
  statuses: (string | null)[],
): QuotationStatusCounts {
  const counts = emptyQuotationStatusCounts();

  for (const raw of statuses) {
    const status = normalizeQuotationStatus(raw);
    if (!status) {
      continue;
    }
    counts[status] += 1;
    counts.total += 1;
  }

  return counts;
}

/** Conteo de cotizaciones por estado creadas dentro del período. */
export async function getDashboardStatusCounts(
  userId: string,
  period: DashboardPeriod,
  now: Date = new Date(),
): Promise<QuotationStatusCounts> {
  const { start, end } = getPeriodBoundaries(period, now);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotations")
    .select("status")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) {
    return emptyQuotationStatusCounts();
  }

  return bucketQuotationStatusCounts(
    (data ?? []).map((row) => (row as { status: string | null }).status),
  );
}
