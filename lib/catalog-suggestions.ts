import type { CatalogItem } from "@/types";

export const DEFAULT_CATALOG_UNITS = [
  "hora",
  "kg",
  "m²",
  "unidad",
  "caja",
  "litro",
  "metro",
] as const;

function getUniqueSortedValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right, "es"));
}

export function getCatalogCategorySuggestions(items: CatalogItem[]) {
  return getUniqueSortedValues(items.map((item) => item.category));
}

export function getCatalogUnitSuggestions(items: CatalogItem[]) {
  return getUniqueSortedValues([
    ...items.map((item) => item.unit),
    ...DEFAULT_CATALOG_UNITS,
  ]);
}
