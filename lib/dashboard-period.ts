import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import { createClient } from "@/lib/supabase/server";

export type DashboardPeriod = "week" | "month";

export type DashboardPeriodSummary = {
  accepted: number;
  spent: number;
  net: number;
  canCalculateNet: boolean;
};

export type DashboardPeriodBoundaries = {
  start: Date;
  end: Date;
  startDateOnly: string;
  endDateOnly: string;
};

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPeriodBoundaries(
  period: DashboardPeriod,
  now: Date = new Date(),
): DashboardPeriodBoundaries {
  if (period === "week") {
    // getDay(): 0=domingo..6=sábado. Queremos arrancar el lunes.
    const diffToMonday = (now.getDay() + 6) % 7;
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - diffToMonday,
      0,
      0,
      0,
      0,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 6,
      23,
      59,
      59,
      999,
    );
    return {
      start,
      end,
      startDateOnly: toDateOnly(start),
      endDateOnly: toDateOnly(end),
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return {
    start,
    end,
    startDateOnly: toDateOnly(start),
    endDateOnly: toDateOnly(end),
  };
}

/** Un "ahora" que cae dentro del período anterior (para comparar variación). */
export function getPreviousPeriodNow(
  period: DashboardPeriod,
  now: Date = new Date(),
): Date {
  if (period === "week") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 7,
      12,
      0,
      0,
      0,
    );
  }

  // Día 0 del mes actual = último día del mes anterior.
  return new Date(now.getFullYear(), now.getMonth(), 0, 12, 0, 0, 0);
}

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

export function summarizeDashboardPeriod(input: {
  acceptedTotal: number;
  expenses: { amount: number; currency: string | null }[];
  profileCurrency: string | null;
}): DashboardPeriodSummary {
  const totalsByCurrency = new Map<string, number>();

  for (const expense of input.expenses) {
    const currency = normalizeExpenseCurrency(expense.currency);
    totalsByCurrency.set(
      currency,
      (totalsByCurrency.get(currency) ?? 0) + parseAmount(expense.amount),
    );
  }

  const entries = Array.from(totalsByCurrency.entries());
  const spent = entries[0]?.[1] ?? 0;
  const normalizedProfileCurrency = normalizeExpenseCurrency(
    input.profileCurrency,
  );
  const canCalculateNet =
    entries.length === 1 && entries[0]?.[0] === normalizedProfileCurrency;
  const net = canCalculateNet ? input.acceptedTotal - spent : 0;

  return {
    accepted: input.acceptedTotal,
    spent,
    net,
    canCalculateNet,
  };
}

export async function getDashboardPeriodSummary(
  userId: string,
  profileCurrency: string | null,
  period: DashboardPeriod,
  now: Date = new Date(),
): Promise<DashboardPeriodSummary> {
  const { start, end, startDateOnly, endDateOnly } = getPeriodBoundaries(
    period,
    now,
  );
  const supabase = await createClient();

  const [acceptedResult, expensesResult] = await Promise.all([
    supabase
      .from("quotations")
      .select("total")
      .eq("user_id", userId)
      .in("status", ["accepted", "approved"])
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    supabase
      .from("expenses")
      .select("amount, currency")
      .eq("user_id", userId)
      .gte("date", startDateOnly)
      .lte("date", endDateOnly),
  ]);

  const acceptedTotal = (acceptedResult.data ?? []).reduce(
    (sum, row) => sum + parseAmount(row.total),
    0,
  );
  const expenses = (expensesResult.data ?? []).map((row) => ({
    amount: parseAmount((row as { amount: unknown }).amount),
    currency: (row as { currency: string | null }).currency ?? null,
  }));

  return summarizeDashboardPeriod({ acceptedTotal, expenses, profileCurrency });
}
