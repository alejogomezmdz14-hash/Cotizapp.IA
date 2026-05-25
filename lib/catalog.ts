import { createClient } from "@/lib/supabase/server";
import type { CatalogItem } from "@/types";

type CatalogItemRow = Omit<CatalogItem, "price"> & {
  price: number | string | null;
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

export async function getCatalogItems(userId: string): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, user_id, name, description, unit, price, category, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No se pudo cargar el catalogo.");
  }

  return ((data ?? []) as CatalogItemRow[]).map((item) => ({
    ...item,
    price: normalizeAmount(item.price),
  }));
}
