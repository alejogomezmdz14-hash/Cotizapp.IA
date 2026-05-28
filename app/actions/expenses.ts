"use server";

import { revalidatePath } from "next/cache";

import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import {
  getExpenseMonthStats,
  getExpenses,
  getExpensesByMonth,
  normalizeExpenseCategory,
  normalizeExpenseDateInput,
  parseExpenseAmountInput,
} from "@/lib/expenses";
import { getProfile, requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Expense, ExpenseMonthGroup, ExpenseMonthStats } from "@/types";

export type ExpenseUpsertInput = {
  description: string;
  amount: string;
  category?: string;
  date: string;
  currency?: string;
  receipt_path?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
};

function revalidateExpenseViews() {
  revalidatePath("/gastos");
  revalidatePath("/dashboard");
}

function getRequiredValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function getDefaultExpenseCurrency(userId: string) {
  const profile = await getProfile(userId);
  return normalizeExpenseCurrency(profile?.currency ?? "ARS");
}

function buildExpensePayload(formData: FormData, defaultCurrency: string) {
  const description = getRequiredValue(formData, "description");
  const amountRaw = getRequiredValue(formData, "amount");
  const category = normalizeExpenseCategory(
    getRequiredValue(formData, "category") || "Otro",
  );
  const date = normalizeExpenseDateInput(getRequiredValue(formData, "date"));
  const currency = normalizeExpenseCurrency(
    getRequiredValue(formData, "currency") || defaultCurrency,
    defaultCurrency,
  );
  const amount = parseExpenseAmountInput(amountRaw);
  const receiptPath =
    getOptionalValue(formData, "receipt_path") ??
    getOptionalValue(formData, "receipt_url");
  const notes = getOptionalValue(formData, "notes");

  if (!description) {
    throw new Error("Ingresá una descripción para el gasto.");
  }

  if (amount === null || amount <= 0) {
    throw new Error("Ingresá un monto válido mayor a cero.");
  }

  return {
    description,
    amount,
    currency,
    category,
    date,
    receipt_url: receiptPath,
    receipt_path: receiptPath,
    notes,
  };
}

function buildExpensePayloadFromInput(
  input: ExpenseUpsertInput,
  defaultCurrency: string,
) {
  const description = input.description.trim();
  const amountRaw = input.amount.trim();
  const category = normalizeExpenseCategory(
    (input.category?.trim() || "Otro"),
  );
  const date = normalizeExpenseDateInput(input.date.trim());
  const currency = normalizeExpenseCurrency(
    input.currency?.trim() || defaultCurrency,
    defaultCurrency,
  );
  const amount = parseExpenseAmountInput(amountRaw);
  const receiptPath =
    input.receipt_path?.trim() ||
    input.receipt_url?.trim() ||
    null;
  const notes = input.notes?.trim() || null;

  if (!description) {
    throw new Error("Ingresá una descripción para el gasto.");
  }

  if (amount === null || amount <= 0) {
    throw new Error("Ingresá un monto válido mayor a cero.");
  }

  return {
    description,
    amount,
    currency,
    category,
    date,
    receipt_url: receiptPath,
    receipt_path: receiptPath,
    notes,
  };
}

export async function createExpense(formData: FormData) {
  const user = await requireUser();
  const defaultCurrency = await getDefaultExpenseCurrency(user.id);
  const payload = buildExpensePayload(formData, defaultCurrency);

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    ...payload,
  });

  if (error) {
    throw new Error("No se pudo guardar el gasto.");
  }

  revalidateExpenseViews();
}

export async function createExpenseFromInput(input: ExpenseUpsertInput) {
  const user = await requireUser();
  const defaultCurrency = await getDefaultExpenseCurrency(user.id);
  const payload = buildExpensePayloadFromInput(input, defaultCurrency);

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    ...payload,
  });

  if (error) {
    throw new Error("No se pudo guardar el gasto.");
  }

  revalidateExpenseViews();
}

export async function updateExpense(id: string, formData: FormData) {
  const user = await requireUser();
  const defaultCurrency = await getDefaultExpenseCurrency(user.id);
  const payload = buildExpensePayload(formData, defaultCurrency);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    throw new Error("No se pudo actualizar el gasto.");
  }

  revalidateExpenseViews();
}

export async function updateExpenseFromInput(id: string, input: ExpenseUpsertInput) {
  const user = await requireUser();
  const defaultCurrency = await getDefaultExpenseCurrency(user.id);
  const payload = buildExpensePayloadFromInput(input, defaultCurrency);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    throw new Error("No se pudo actualizar el gasto.");
  }

  revalidateExpenseViews();
}

export async function deleteExpense(id: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    throw new Error("No se pudo eliminar el gasto.");
  }

  revalidateExpenseViews();
}

export async function getExpensesByMonthAction(): Promise<ExpenseMonthGroup[]> {
  const user = await requireUser();
  return getExpensesByMonth(user.id);
}

export async function getExpenseStatsAction(): Promise<ExpenseMonthStats> {
  const user = await requireUser();
  return getExpenseMonthStats(user.id);
}

export async function getExpensesAction(): Promise<Expense[]> {
  const user = await requireUser();
  return getExpenses(user.id);
}

export const createExpenseAction = createExpense;
export const updateExpenseAction = updateExpense;
export const deleteExpenseAction = deleteExpense;
