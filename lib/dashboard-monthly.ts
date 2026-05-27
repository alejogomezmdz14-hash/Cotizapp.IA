import { formatMonthShortLabel } from "@/lib/formatting";
import { createClient } from "@/lib/supabase/server";
import type { DashboardMonthlyPoint } from "@/types";

function parseAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getMonthBoundaries(monthsAgo: number) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - monthsAgo;
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const dateOnlyStart = start.toISOString().slice(0, 10);
  const dateOnlyEnd = end.toISOString().slice(0, 10);

  return {
    label: formatMonthShortLabel(start),
    isoStart: start.toISOString(),
    isoEnd: end.toISOString(),
    dateOnlyStart,
    dateOnlyEnd,
  };
}

export async function getCollectedThisMonth(userId: string) {
  const { isoStart, isoEnd } = getMonthBoundaries(0);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("total")
    .eq("user_id", userId)
    .not("paid_at", "is", null)
    .gte("paid_at", isoStart)
    .lte("paid_at", isoEnd);

  if (error) {
    return 0;
  }

  return (data ?? []).reduce(
    (sum, row) => sum + parseAmount(row.total),
    0,
  );
}

export async function getDashboardMonthlyComparison(
  userId: string,
): Promise<DashboardMonthlyPoint[]> {
  const supabase = await createClient();
  const monthRanges = Array.from({ length: 6 }, (_, index) =>
    getMonthBoundaries(5 - index),
  );

  const points = await Promise.all(
    monthRanges.map(async (range) => {
      const [quotationsResult, expensesResult] = await Promise.all([
        supabase
          .from("quotations")
          .select("total")
          .eq("user_id", userId)
          .gte("created_at", range.isoStart)
          .lte("created_at", range.isoEnd),
        supabase
          .from("expenses")
          .select("amount")
          .eq("user_id", userId)
          .gte("date", range.dateOnlyStart)
          .lte("date", range.dateOnlyEnd),
      ]);

      const quoted = (quotationsResult.data ?? []).reduce(
        (sum, row) => sum + parseAmount(row.total),
        0,
      );
      const expenses = (expensesResult.data ?? []).reduce(
        (sum, row) => sum + parseAmount(row.amount),
        0,
      );

      return {
        monthLabel: range.label,
        quoted,
        expenses,
      };
    }),
  );

  return points;
}
