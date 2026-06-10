export const DEFAULT_CATALOG_UNIT = "unidad";

export function normalizeCatalogUnit(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return DEFAULT_CATALOG_UNIT;
  }

  return normalizedValue;
}
