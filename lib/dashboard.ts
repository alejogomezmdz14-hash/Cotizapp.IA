import {
  getDashboardMonthlyComparison,
  getInvoicedThisMonth,
} from "@/lib/dashboard-monthly";
import {
  getAcceptedQuotedThisMonth,
  getExpenseMonthStats,
} from "@/lib/expenses";
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import { createClient } from "@/lib/supabase/server";
import type {
  DashboardQuotationMetrics,
  DashboardStats,
  ExpenseCurrencyTotal,
} from "@/types";

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

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  quotations: 0,
  clients: 0,
  catalogItems: 0,
  quotationMetrics: EMPTY_DASHBOARD_QUOTATION_METRICS,
  expensesThisMonth: 0,
  expensesByCurrency: [],
  acceptedQuotedThisMonth: 0,
  invoicedThisMonth: 0,
  netProfitThisMonth: 0,
  canCalculateNetProfit: false,
  monthlyComparison: [],
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

function getPrimaryExpenseTotal(totals: ExpenseCurrencyTotal[]) {
  if (totals.length === 0) {
    return 0;
  }

  return totals[0]?.total ?? 0;
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

async function getDashboardQuotationMetricsFallback(userId: string) {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  const { data, error } = await supabase
    .from("quotations")
    .select("status, total, sent_at, created_at")
    .eq("user_id", userId);

  if (error) {
    return parseDashboardQuotationMetricsRow(null);
  }

  const rows = data ?? [];
  const monthStartMs = monthStart.getTime();
  const nextMonthStartMs = nextMonthStart.getTime();

  let totalQuotedThisMonth = 0;
  let sentQuotations = 0;
  let acceptedQuotations = 0;
  let pendingQuotations = 0;

  for (const row of rows) {
    const status = row.status?.trim().toLowerCase() ?? "";
    const createdAt = row.created_at ? Date.parse(row.created_at) : Number.NaN;

    if (row.sent_at) {
      sentQuotations += 1;
    }

    if (status === "accepted" || status === "approved") {
      acceptedQuotations += 1;
    }

    if (status === "pending" || status === "sent") {
      pendingQuotations += 1;
    }

    if (
      (status === "accepted" || status === "approved") &&
      Number.isFinite(createdAt) &&
      createdAt >= monthStartMs &&
      createdAt < nextMonthStartMs
    ) {
      totalQuotedThisMonth += parseDashboardMoney(row.total);
    }
  }

  return parseDashboardQuotationMetricsRow({
    quotations: rows.length,
    sent_quotations: sentQuotations,
    accepted_quotations: acceptedQuotations,
    pending_quotations: pendingQuotations,
    total_quoted_this_month: totalQuotedThisMonth,
  });
}

export async function getDashboardStats(
  userId: string,
  profileCurrency: string | null = null,
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
      totalsByCurrency: [],
      expenseCount: 0,
      topCategory: null,
      topCategoryAmount: 0,
    })),
    getAcceptedQuotedThisMonth().catch(() => 0),
    getInvoicedThisMonth(userId).catch(() => 0),
    getDashboardMonthlyComparison(userId).catch(() => []),
  ]);

  if (clientsResult.error || catalogItemsResult.error) {
    return {
      ...EMPTY_DASHBOARD_STATS,
      quotationMetrics: quotationMetricsResult.error
        ? (
            await getDashboardQuotationMetricsFallback(userId)
          ).quotationMetrics
        : parseDashboardQuotationMetricsRow(
            (quotationMetricsResult.data as DashboardQuotationMetricsRpcRow | null | undefined) ??
              null,
          ).quotationMetrics,
    };
  }

  const quotationSummary = quotationMetricsResult.error
    ? await getDashboardQuotationMetricsFallback(userId)
    : parseDashboardQuotationMetricsRow(
        (quotationMetricsResult.data as DashboardQuotationMetricsRpcRow | null | undefined) ??
          null,
      );

  const expensesByCurrency = expenseMonthStats.totalsByCurrency;
  const expensesThisMonth = getPrimaryExpenseTotal(expensesByCurrency);
  const normalizedProfileCurrency = normalizeExpenseCurrency(
    profileCurrency ?? "ARS",
  );
  const hasExpenses = expenseMonthStats.expenseCount > 0;
  const singleExpenseCurrency =
    expensesByCurrency.length === 1 ? expensesByCurrency[0]?.currency : null;
  const canCalculateNetProfit =
    hasExpenses &&
    expensesByCurrency.length === 1 &&
    singleExpenseCurrency === normalizedProfileCurrency;

  const netProfitThisMonth = canCalculateNetProfit
    ? acceptedQuotedThisMonth - (expensesByCurrency[0]?.total ?? 0)
    : 0;

  return {
    quotations: quotationSummary.quotations,
    clients: clientsResult.count ?? 0,
    catalogItems: catalogItemsResult.count ?? 0,
    quotationMetrics: quotationSummary.quotationMetrics,
    expensesThisMonth,
    expensesByCurrency,
    acceptedQuotedThisMonth,
    invoicedThisMonth,
    netProfitThisMonth,
    canCalculateNetProfit,
    monthlyComparison,
  };
}
