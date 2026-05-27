import { isExpenseCategory } from "@/lib/expense-categories";
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import { createClient } from "@/lib/supabase/server";
import type {
  Expense,
  ExpenseCurrencyTotal,
  ExpenseMonthGroup,
  ExpenseMonthStats,
} from "@/types";

const EXPENSE_SELECT_COLUMNS =
  "id, user_id, description, amount, currency, category, date, receipt_url, receipt_path, notes, created_at";

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

function getMonthBoundsUtc(reference = new Date()) {
  const monthStart = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );
  const nextMonthStart = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1),
  );

  return {
    monthStart: monthStart.toISOString().slice(0, 10),
    nextMonthStart: nextMonthStart.toISOString().slice(0, 10),
  };
}

function normalizeExpenseRow(row: Record<string, unknown>): Expense {
  const receiptPath =
    (typeof row.receipt_path === "string" ? row.receipt_path : null) ??
    (typeof row.receipt_url === "string" ? row.receipt_url : null);

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    description: String(row.description ?? ""),
    amount: parseAmount(row.amount),
    currency: normalizeExpenseCurrency(String(row.currency ?? "ARS")),
    category: normalizeExpenseCategory(String(row.category ?? "Otro")),
    date: String(row.date ?? new Date().toISOString().slice(0, 10)),
    receipt_url: typeof row.receipt_url === "string" ? row.receipt_url : receiptPath,
    receipt_path: receiptPath,
    notes: typeof row.notes === "string" ? row.notes : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

function getMonthKeyFromDate(dateValue: string) {
  return dateValue.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  if (!year || !month) {
    return monthKey;
  }

  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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

function buildTotalsByCurrency(
  rows: Array<{ amount: unknown; currency: unknown }>,
): ExpenseCurrencyTotal[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const currency = normalizeExpenseCurrency(String(row.currency ?? "ARS"));
    const amount = parseAmount(row.amount);
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }

  return Array.from(totals.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No se pudieron cargar los gastos.");
  }

  return (data ?? []).map((row) => normalizeExpenseRow(row as Record<string, unknown>));
}

export async function getExpensesByMonth(userId: string): Promise<ExpenseMonthGroup[]> {
  const expenses = await getExpenses(userId);
  const groups = new Map<string, Expense[]>();

  for (const expense of expenses) {
    const monthKey = getMonthKeyFromDate(expense.date);
    const current = groups.get(monthKey) ?? [];
    current.push(expense);
    groups.set(monthKey, current);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([monthKey, monthExpenses]) => ({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      expenses: monthExpenses,
    }));
}

export async function getExpenseStats(userId: string): Promise<ExpenseMonthStats> {
  const supabase = await createClient();
  const { monthStart, nextMonthStart } = getMonthBoundsUtc();

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, currency, category")
    .eq("user_id", userId)
    .gte("date", monthStart)
    .lt("date", nextMonthStart);

  if (error) {
    throw new Error("No se pudieron calcular los gastos del mes.");
  }

  const rows = data ?? [];
  const totalsByCurrency = buildTotalsByCurrency(rows);
  const categoryTotals = new Map<string, number>();

  for (const row of rows) {
    const category = normalizeExpenseCategory(String(row.category ?? "Otro"));
    const amount = parseAmount(row.amount);
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + amount);
  }

  let topCategory: string | null = null;
  let topCategoryAmount = 0;

  for (const [category, total] of Array.from(categoryTotals.entries())) {
    if (total > topCategoryAmount) {
      topCategory = category;
      topCategoryAmount = total;
    }
  }

  return {
    totalsByCurrency,
    expenseCount: rows.length,
    topCategory,
    topCategoryAmount,
  };
}

export async function getExpenseMonthStats(
  userId: string,
): Promise<ExpenseMonthStats> {
  return getExpenseStats(userId);
}

export async function getAcceptedQuotedThisMonth(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_accepted_quoted_this_month");

  if (error) {
    return 0;
  }

  return parseAmount(data);
}
