import { getArgentinaMonthDateBounds } from "@/lib/argentina-time";
import { normalizeExpenseCategory } from "@/lib/expense-categories";
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import { formatMonthLabel } from "@/lib/formatting";
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
  // `expenses.date` es una columna DATE (calendario), así que usamos los límites
  // del mes en horario de Argentina, no en UTC (si no, cerca de medianoche
  // contábamos el mes equivocado).
  const { monthStart, nextMonthStart } = getArgentinaMonthDateBounds(0, reference);
  return { monthStart, nextMonthStart };
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

function getMonthBoundsFromKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  if (!year || !month) {
    return getMonthBoundsUtc();
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, month, 1));

  return {
    monthStart: monthStart.toISOString().slice(0, 10),
    nextMonthStart: nextMonthStart.toISOString().slice(0, 10),
  };
}

// Movido a lib/expense-amount.ts (módulo puro, importable desde el cliente).
// Se re-exporta acá para no romper a los consumidores server-side existentes.
export { parseExpenseAmountInput } from "@/lib/expense-amount";

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

export { normalizeExpenseCategory } from "@/lib/expense-categories";

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

export async function getExpenseStatsForMonth(
  userId: string,
  monthKey?: string,
): Promise<ExpenseMonthStats> {
  const supabase = await createClient();
  const { monthStart, nextMonthStart } = monthKey
    ? getMonthBoundsFromKey(monthKey)
    : getMonthBoundsUtc();

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
  return getExpenseStatsForMonth(userId);
}

export async function getAcceptedQuotedThisMonth(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_accepted_quoted_this_month");

  if (error) {
    return 0;
  }

  return parseAmount(data);
}
