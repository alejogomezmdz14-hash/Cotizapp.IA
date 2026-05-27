import { createClient } from "@/lib/supabase/server";
import type { Quotation } from "@/types";

export type QuotationRow = Omit<Quotation, "status" | "subtotal" | "tax_rate" | "total"> & {
  status: string | null;
  subtotal: number | string | null;
  tax_rate: number | string | null;
  total: number | string | null;
};

const QUOTATION_CORE_COLUMNS =
  "id, user_id, client_id, client_name, number, status, notes, subtotal, tax_rate, total, valid_until, created_at";

const QUOTATION_OUTPUT_COLUMNS =
  "id, user_id, client_id, client_name, number, status, notes, subtotal, tax_rate, total, valid_until, pdf_path, pdf_generated_at, share_token, sent_at, created_at";

const QUOTATION_EXTENDED_COLUMNS =
  "id, user_id, client_id, client_name, number, status, notes, subtotal, tax_rate, total, valid_until, pdf_path, pdf_generated_at, share_token, sent_at, paid_at, signature_url, created_at";

const QUOTATION_SELECT_FALLBACKS = [
  QUOTATION_EXTENDED_COLUMNS,
  QUOTATION_OUTPUT_COLUMNS,
  QUOTATION_CORE_COLUMNS,
] as const;

export function normalizeQuotationListRow(row: QuotationRow): Quotation {
  return {
    ...row,
    status: row.status as Quotation["status"],
    subtotal:
      typeof row.subtotal === "number"
        ? row.subtotal
        : row.subtotal
          ? Number(row.subtotal)
          : null,
    tax_rate:
      typeof row.tax_rate === "number"
        ? row.tax_rate
        : row.tax_rate
          ? Number(row.tax_rate)
          : null,
    total:
      typeof row.total === "number"
        ? row.total
        : row.total
          ? Number(row.total)
          : null,
    paid_at: row.paid_at ?? null,
    signature_url: row.signature_url ?? null,
    pdf_path: row.pdf_path ?? null,
    pdf_generated_at: row.pdf_generated_at ?? null,
    share_token: row.share_token ?? null,
    sent_at: row.sent_at ?? null,
    accepted_at: row.accepted_at ?? null,
    rejected_at: row.rejected_at ?? null,
  };
}

export async function fetchUserQuotations(userId: string): Promise<Quotation[]> {
  const supabase = await createClient();

  for (const columns of QUOTATION_SELECT_FALLBACKS) {
    const { data, error } = await supabase
      .from("quotations")
      .select(columns)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error) {
      return ((data ?? []) as unknown as QuotationRow[]).map((row) =>
        normalizeQuotationListRow(row),
      );
    }
  }

  return [];
}

export async function fetchUserQuotationById(
  userId: string,
  quotationId: string,
): Promise<QuotationRow | null> {
  const supabase = await createClient();

  for (const columns of QUOTATION_SELECT_FALLBACKS) {
    const { data, error } = await supabase
      .from("quotations")
      .select(columns)
      .eq("id", quotationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!error) {
      return (data as unknown as QuotationRow | null) ?? null;
    }
  }

  return null;
}
