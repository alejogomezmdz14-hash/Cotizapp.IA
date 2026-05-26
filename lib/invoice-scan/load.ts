import { loadPersistedInvoiceScanReview } from "@/lib/invoice-scan/persistence";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceScan } from "@/types";

export async function getPersistedInvoiceScanReview(
  userId: string,
  scanId: string | null | undefined,
) {
  return loadPersistedInvoiceScanReview(
    {
      getScan: async (targetScanId) => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("invoice_scans")
          .select("*")
          .eq("id", targetScanId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          throw new Error("No se pudo cargar la factura escaneada.");
        }

        return (data as InvoiceScan | null) ?? null;
      },
    },
    scanId,
  );
}
