import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceItem } from "@/types";

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeInvoiceRow(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    quotation_id: (row.quotation_id as string | null) ?? null,
    client_id: (row.client_id as string | null) ?? null,
    client_name: (row.client_name as string | null) ?? null,
    invoice_number: String(row.invoice_number),
    status: (row.status as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    subtotal: parseNumber(row.subtotal),
    tax_rate: parseNumber(row.tax_rate),
    total: parseNumber(row.total),
    valid_until: (row.valid_until as string | null) ?? null,
    pdf_path: (row.pdf_path as string | null) ?? null,
    pdf_generated_at: (row.pdf_generated_at as string | null) ?? null,
    share_token: (row.share_token as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    paid_at: (row.paid_at as string | null) ?? null,
    signature_url: (row.signature_url as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
  };
}

const INVOICE_COLUMNS =
  "id, user_id, quotation_id, client_id, client_name, invoice_number, status, notes, subtotal, tax_rate, total, valid_until, pdf_path, pdf_generated_at, share_token, sent_at, paid_at, signature_url, created_at";

export async function buildNextInvoiceNumber(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error("No se pudo generar el número de factura.");
  }

  const latest = data?.[0]?.invoice_number ?? null;
  const match = latest?.match(/FAC-(\d+)/i);
  const nextSequence = match ? Number(match[1]) + 1 : 1;

  return `FAC-${String(nextSequence).padStart(4, "0")}`;
}

export async function getInvoices(userId: string): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No se pudieron cargar las facturas.");
  }

  return (data ?? []).map((row) => normalizeInvoiceRow(row as Record<string, unknown>));
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_items")
    .select(
      "id, invoice_id, position, catalog_item_id, name, description, quantity, unit, unit_price, total",
    )
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error("No se pudieron cargar los ítems de la factura.");
  }

  return (data ?? []).map((row) => ({
    ...row,
    position: parseNumber(row.position),
    quantity: parseNumber(row.quantity),
    unit_price: parseNumber(row.unit_price),
    total: parseNumber(row.total),
  })) as InvoiceItem[];
}
