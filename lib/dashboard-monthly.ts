import {
  getArgentinaMonthDateBounds,
  getArgentinaMonthInstantBounds,
} from "@/lib/argentina-time";
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import { formatMonthShortLabel } from "@/lib/formatting";
import { normalizeQuotationStatus } from "@/lib/quotation-status";
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
  // Límites del mes en horario de Argentina. `created_at`/`paid_at` son instantes
  // (timestamptz) → usamos los límites con offset UTC-3. `expenses.date` es DATE
  // (calendario) → usamos los límites calendario. Antes se usaba UTC y cerca de
  // medianoche el mes salía corrido.
  const instant = getArgentinaMonthInstantBounds(monthsAgo);
  const dateBounds = getArgentinaMonthDateBounds(monthsAgo);

  return {
    label: formatMonthShortLabel(instant.monthLabelDate),
    isoStart: instant.isoStart,
    isoEnd: instant.isoEnd,
    dateOnlyStart: dateBounds.monthStart,
    dateOnlyEnd: dateBounds.monthEnd,
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
  profileCurrency: string | null,
): Promise<DashboardMonthlyPoint[]> {
  const supabase = await createClient();
  const normalizedProfileCurrency = normalizeExpenseCurrency(profileCurrency);
  const monthRanges = Array.from({ length: 6 }, (_, index) =>
    getMonthBoundaries(5 - index),
  );

  const points = await Promise.all(
    monthRanges.map(async (range) => {
      const [quotationsResult, expensesResult] = await Promise.all([
        supabase
          .from("quotations")
          .select("total, status")
          .eq("user_id", userId)
          .gte("created_at", range.isoStart)
          .lte("created_at", range.isoEnd),
        supabase
          .from("expenses")
          .select("amount, currency")
          .eq("user_id", userId)
          .gte("date", range.dateOnlyStart)
          .lte("date", range.dateOnlyEnd),
      ]);

      const quotationRows = quotationsResult.data ?? [];
      const quoted = quotationRows.reduce(
        (sum, row) => sum + parseAmount(row.total),
        0,
      );
      const accepted = quotationRows.reduce(
        (sum, row) =>
          normalizeQuotationStatus((row as { status: string | null }).status) ===
          "accepted"
            ? sum + parseAmount(row.total)
            : sum,
        0,
      );
      // El gráfico no puede sumar monedas mezcladas: solo cuentan los gastos
      // en la moneda del perfil (misma con la que la UI formatea el eje).
      const expenses = (expensesResult.data ?? []).reduce(
        (sum, row) =>
          normalizeExpenseCurrency(
            (row as { currency: string | null }).currency,
          ) === normalizedProfileCurrency
            ? sum + parseAmount(row.amount)
            : sum,
        0,
      );

      return {
        monthLabel: range.label,
        quoted,
        expenses,
        accepted,
      };
    }),
  );

  return points;
}
