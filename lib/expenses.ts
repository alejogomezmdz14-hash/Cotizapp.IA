import { isExpenseCategory } from "@/lib/expense-categories";
import { createClient } from "@/lib/supabase/server";
import type { Expense, ExpenseMonthStats } from "@/types";

function parseAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getMonthBoundsUtc() {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  return {
    monthStart: monthStart.toISOString().slice(0, 10),
    nextMonthStart: nextMonthStart.toISOString().slice(0, 10),
  };
}

export function parseExpenseAmountInput(value: string) {
  const compactValue = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!compactValue || !/\d/.test(compactValue)) {
    return null;
  }

  const isNegative = compactValue.startsWith("-");
  const unsignedValue = isNegative ? compactValue.slice(1) : compactValue;
  const lastCommaIndex = unsignedValue.lastIndexOf(",");
  const lastDotIndex = unsignedValue.lastIndexOf(".");

  let normalized = unsignedValue;

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const thousandsPattern = decimalSeparator === "," ? /\./g : /,/g;
    normalized = unsignedValue
      .replace(thousandsPattern, "")
      .replace(decimalSeparator, ".");
  } else if (lastCommaIndex !== -1) {
    const parts = unsignedValue.split(",");
    normalized =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0]}.${parts[1]}`
        : unsignedValue.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return isNegative ? -parsed : parsed;
}

export function normalizeExpenseDateInput(value: string | null | undefined) {
  if (typeof value !== "string") {
    return new Date().toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date().toISOString().slice(0, 10);
  }

  return trimmed;
}

export function normalizeExpenseCategory(value: string) {
  const trimmed = value.trim();
  return isExpenseCategory(trimmed) ? trimmed : "Otro";
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, user_id, description, amount, currency, category, date, receipt_url, created_at",
    )
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No se pudieron cargar los gastos.");
  }

  return (data ?? []).map((row) => ({
    ...row,
    amount: parseAmount(row.amount),
  })) as Expense[];
}

export async function getExpenseMonthStats(
  userId: string,
): Promise<ExpenseMonthStats> {
  const supabase = await createClient();
  const { monthStart, nextMonthStart } = getMonthBoundsUtc();

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, category")
    .eq("user_id", userId)
    .gte("date", monthStart)
    .lt("date", nextMonthStart);

  if (error) {
    throw new Error("No se pudieron calcular los gastos del mes.");
  }

  const rows = data ?? [];
  const categoryCounts = new Map<string, number>();
  let totalThisMonth = 0;

  for (const row of rows) {
    const amount = parseAmount(row.amount);
    totalThisMonth += amount;
    const category = normalizeExpenseCategory(String(row.category ?? "Otro"));
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  let topCategory: string | null = null;
  let topCount = 0;

  for (const [category, count] of Array.from(categoryCounts.entries())) {
    if (count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }

  return {
    totalThisMonth,
    expenseCount: rows.length,
    topCategory,
  };
}

export async function getAcceptedQuotedThisMonth(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_accepted_quoted_this_month");

  if (error) {
    return 0;
  }

  return parseAmount(data);
}
