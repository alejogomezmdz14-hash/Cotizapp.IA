import { createClient } from "@/lib/supabase/server";
import type { DashboardStats } from "@/types";

export async function getDashboardStats(
  userId: string,
): Promise<DashboardStats> {
  const supabase = await createClient();

  const [quotationsResult, clientsResult, catalogItemsResult] =
    await Promise.all([
      supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

  if (
    quotationsResult.error ||
    clientsResult.error ||
    catalogItemsResult.error
  ) {
    throw new Error("No se pudo cargar el resumen del panel.");
  }

  return {
    quotations: quotationsResult.count ?? 0,
    clients: clientsResult.count ?? 0,
    catalogItems: catalogItemsResult.count ?? 0,
  };
}
