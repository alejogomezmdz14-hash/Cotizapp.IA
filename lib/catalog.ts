import { createClient } from "@/lib/supabase/server";
import type { CatalogItem } from "@/types";

export type CatalogFormValues = {
  name: string;
  description: string | null;
  unit: string;
  price: number;
  category: string | null;
};

type CatalogItemRow = Omit<CatalogItem, "price"> & {
  price: number | string | null;
};

export type CatalogMutationAction = "update" | "delete";

type CatalogMutationRow = {
  id: string;
};

type DatabaseErrorLike = {
  code?: string | null;
} | null;

export type CatalogReadOptions = {
  search?: string;
  orderBy?: "created_at" | "name" | "price" | "category";
  ascending?: boolean;
};

export const DEFAULT_CATALOG_UNIT = "unidad";

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

function getRequiredCatalogValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalCatalogValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function normalizeCatalogUnit(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return DEFAULT_CATALOG_UNIT;
  }

  return normalizedValue;
}

function normalizePriceInput(value: string) {
  const compactValue = value.trim().replace(/\s+/g, "");

  if (!compactValue) {
    return "";
  }

  if (!/^\d+(?:[.,]\d+)?$/.test(compactValue)) {
    throw new Error("Ingresa un precio valido mayor o igual a cero.");
  }

  return compactValue.replace(",", ".");
}

function parseCatalogPrice(formData: FormData) {
  const rawValue = formData.get("price");
  const normalizedValue =
    typeof rawValue === "string" ? normalizePriceInput(rawValue) : "";

  if (!normalizedValue) {
    throw new Error("El precio es obligatorio.");
  }

  const price = Number.parseFloat(normalizedValue);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Ingresa un precio valido mayor o igual a cero.");
  }

  return price;
}

export function parseCatalogFormData(formData: FormData): CatalogFormValues {
  const name = getRequiredCatalogValue(formData, "name");

  if (!name) {
    throw new Error("El nombre del item es obligatorio.");
  }

  return {
    name,
    description: getOptionalCatalogValue(formData, "description"),
    unit: normalizeCatalogUnit(getOptionalCatalogValue(formData, "unit")),
    price: parseCatalogPrice(formData),
    category: getOptionalCatalogValue(formData, "category"),
  };
}

export function escapeCatalogSearchTerm(search: string) {
  return search
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll("*", "\\*");
}

export function buildCatalogSearchFilter(search?: string) {
  const normalizedSearch = search?.trim();

  if (!normalizedSearch) {
    return null;
  }

  const escapedSearch = escapeCatalogSearchTerm(normalizedSearch);
  const pattern = `"%${escapedSearch}%"`;

  return `name.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},unit.ilike.${pattern}`;
}

export function assertSingleCatalogMutation(
  rows: CatalogMutationRow[] | null,
  action: CatalogMutationAction,
) {
  if ((rows?.length ?? 0) === 1) {
    return;
  }

  if (action === "update") {
    throw new Error("El item no existe o no tenes permisos para actualizarlo.");
  }

  throw new Error("El item no existe, no te pertenece o ya fue eliminado.");
}

export function getCatalogDeleteFailureMessage(error: DatabaseErrorLike) {
  if (error?.code === "23503") {
    return "No se puede eliminar el item porque esta siendo usado en otras entidades.";
  }

  return "No se pudo eliminar el item.";
}

export async function getCatalogItems(
  userId: string,
  options: CatalogReadOptions = {},
): Promise<CatalogItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("catalog_items")
    .select("id, user_id, name, description, unit, price, category, created_at")
    .eq("user_id", userId);

  const searchFilter = buildCatalogSearchFilter(options.search);

  if (searchFilter) {
    query = query.or(searchFilter);
  }

  const orderBy = options.orderBy ?? "created_at";
  const ascending = options.ascending ?? false;

  const { data, error } = await query.order(orderBy, { ascending });

  if (error) {
    throw new Error("No se pudo cargar el catalogo.");
  }

  return ((data ?? []) as CatalogItemRow[]).map((item) => ({
    ...item,
    unit: normalizeCatalogUnit(item.unit),
    price: normalizeAmount(item.price),
  }));
}
