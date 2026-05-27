import {
  getDashboardMonthlyComparison,
  getInvoicedThisMonth,
} from "@/lib/dashboard-monthly";
import {
  getAcceptedQuotedThisMonth,
  getExpenseMonthStats,
} from "@/lib/expenses";
import { createClient } from "@/lib/supabase/server";
import type { DashboardQuotationMetrics, DashboardStats } from "@/types";

type DashboardQuotationMetricsRpcRow = {
  quotations: number | string | null;
  sent_quotations: number | string | null;
  accepted_quotations: number | string | null;
  pending_quotations: number | string | null;
  total_quoted_this_month: number | string | null;
};

const EMPTY_DASHBOARD_QUOTATION_METRICS: DashboardQuotationMetrics = {
  totalQuotedThisMonth: 0,
  sentQuotations: 0,
  acceptedQuotations: 0,
  pendingQuotations: 0,
};

function parseDashboardMoney(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value.trim());
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

function parseDashboardCount(value: number | string | null | undefined) {
  const parsedValue = parseDashboardMoney(value);

  return Number.isFinite(parsedValue) ? Math.max(0, Math.trunc(parsedValue)) : 0;
}

export function parseDashboardQuotationMetricsRow(
  row: DashboardQuotationMetricsRpcRow | null | undefined,
) {
  return {
    quotations: parseDashboardCount(row?.quotations),
    quotationMetrics: {
      ...EMPTY_DASHBOARD_QUOTATION_METRICS,
      totalQuotedThisMonth: parseDashboardMoney(row?.total_quoted_this_month),
      sentQuotations: parseDashboardCount(row?.sent_quotations),
      acceptedQuotations: parseDashboardCount(row?.accepted_quotations),
      pendingQuotations: parseDashboardCount(row?.pending_quotations),
    },
  };
}

export async function getDashboardStats(
  userId: string,
): Promise<DashboardStats> {
  const supabase = await createClient();

  const [
    quotationMetricsResult,
    clientsResult,
    catalogItemsResult,
    expenseMonthStats,
    acceptedQuotedThisMonth,
    invoicedThisMonth,
    monthlyComparison,
  ] = await Promise.all([
    supabase.rpc("get_dashboard_quotation_metrics").single(),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("catalog_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    getExpenseMonthStats(userId).catch(() => ({
      totalThisMonth: 0,
      expenseCount: 0,
      topCategory: null,
    })),
    getAcceptedQuotedThisMonth().catch(() => 0),
    getInvoicedThisMonth(userId).catch(() => 0),
    getDashboardMonthlyComparison(userId).catch(() => []),
  ]);

  if (
    quotationMetricsResult.error ||
    clientsResult.error ||
    catalogItemsResult.error
  ) {
    throw new Error("No se pudo cargar el resumen del panel.");
  }

  const quotationSummary = parseDashboardQuotationMetricsRow(
    (quotationMetricsResult.data as DashboardQuotationMetricsRpcRow | null | undefined) ??
      null,
  );

  const expensesThisMonth = expenseMonthStats.totalThisMonth;
  const netProfitThisMonth = acceptedQuotedThisMonth - expensesThisMonth;

  return {
    quotations: quotationSummary.quotations,
    clients: clientsResult.count ?? 0,
    catalogItems: catalogItemsResult.count ?? 0,
    quotationMetrics: quotationSummary.quotationMetrics,
    expensesThisMonth,
    acceptedQuotedThisMonth,
    invoicedThisMonth,
    netProfitThisMonth,
    monthlyComparison,
  };
}
