import { createClient } from "@/lib/supabase/server";
import type { Quotation } from "@/types";

type QuotationRow = Omit<Quotation, "subtotal" | "tax_rate" | "total"> & {
  subtotal: number | string | null;
  tax_rate: number | string | null;
  total: number | string | null;
};

function normalizeAmount(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  return 0;
}

export async function getQuotations(userId: string): Promise<Quotation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(
      "id, user_id, client_id, client_name, number, status, notes, subtotal, tax_rate, total, valid_until, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No se pudieron cargar las cotizaciones.");
  }

  return ((data ?? []) as QuotationRow[]).map((quotation) => ({
    ...quotation,
    subtotal: normalizeAmount(quotation.subtotal),
    tax_rate: normalizeAmount(quotation.tax_rate),
    total: normalizeAmount(quotation.total),
  }));
}
