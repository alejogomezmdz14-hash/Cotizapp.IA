"use server";

import { revalidatePath } from "next/cache";

import {
  normalizeExpenseCategory,
  normalizeExpenseDateInput,
  parseExpenseAmountInput,
} from "@/lib/expenses";
import { normalizeProfileCurrency } from "@/lib/profile";
import { requireUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

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

function getOptionalReceiptPath(formData: FormData) {
  const value = formData.get("receipt_url");

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function createExpenseAction(formData: FormData) {
  const user = await requireUser();
  const description = getRequiredValue(formData, "description");
  const amountRaw = getRequiredValue(formData, "amount");
  const category = normalizeExpenseCategory(
    getRequiredValue(formData, "category") || "Otro",
  );
  const date = normalizeExpenseDateInput(getRequiredValue(formData, "date"));
  const currencyInput = getRequiredValue(formData, "currency");

  const amount = parseExpenseAmountInput(amountRaw);

  if (!description) {
    throw new Error("Ingresá una descripción para el gasto.");
  }

  if (amount === null || amount <= 0) {
    throw new Error("Ingresá un monto válido mayor a cero.");
  }

  let currency = "MXN";

  try {
    currency = normalizeProfileCurrency(currencyInput || "MXN");
  } catch {
    currency = "MXN";
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    user_id: user.id,
    description,
    amount,
    currency,
    category,
    date,
    receipt_url: getOptionalReceiptPath(formData),
  });

  if (error) {
    throw new Error("No se pudo guardar el gasto.");
  }

  revalidateExpenseViews();
}

export async function updateExpenseAction(id: string, formData: FormData) {
  const user = await requireUser();
  const description = getRequiredValue(formData, "description");
  const amountRaw = getRequiredValue(formData, "amount");
  const category = normalizeExpenseCategory(
    getRequiredValue(formData, "category") || "Otro",
  );
  const date = normalizeExpenseDateInput(getRequiredValue(formData, "date"));
  const currencyInput = getRequiredValue(formData, "currency");

  const amount = parseExpenseAmountInput(amountRaw);

  if (!description) {
    throw new Error("Ingresá una descripción para el gasto.");
  }

  if (amount === null || amount <= 0) {
    throw new Error("Ingresá un monto válido mayor a cero.");
  }

  let currency = "MXN";

  try {
    currency = normalizeProfileCurrency(currencyInput || "MXN");
  } catch {
    currency = "MXN";
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({
      description,
      amount,
      currency,
      category,
      date,
      receipt_url: getOptionalReceiptPath(formData),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error || !data?.length) {
    throw new Error("No se pudo actualizar el gasto.");
  }

  revalidateExpenseViews();
}

export async function deleteExpenseAction(id: string) {
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
