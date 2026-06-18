import { createClient } from "@/lib/supabase/server";

export type QuotationInvoicing = {
  cae: string | null;
  caeVencimiento: string | null;
  numeroFactura: string | null;
  facturadoAt: string | null;
};

const EMPTY: QuotationInvoicing = {
  cae: null,
  caeVencimiento: null,
  numeroFactura: null,
  facturadoAt: null,
};

export async function getQuotationInvoicing(
  userId: string,
  quotationId: string,
): Promise<QuotationInvoicing> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("cae, cae_vencimiento, numero_factura, facturado_at")
    .eq("id", quotationId)
    .eq("user_id", userId)
    .maybeSingle();

  // Si las columnas no existen todavía (migración sin aplicar) o no hay fila,
  // devolvemos vacío: la cotización simplemente no está facturada.
  if (error || !data) {
    return EMPTY;
  }

  const row = data as Record<string, unknown>;
  return {
    cae: (row.cae as string | null) ?? null,
    caeVencimiento: (row.cae_vencimiento as string | null) ?? null,
    numeroFactura: (row.numero_factura as string | null) ?? null,
    facturadoAt: (row.facturado_at as string | null) ?? null,
  };
}
