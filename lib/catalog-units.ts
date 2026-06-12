export const DEFAULT_CATALOG_UNIT = "unidad";

// La IA de escaneo suele devolver unidades en inglés; las mapeamos al
// vocabulario en español que usa el resto de la app.
const UNIT_TRANSLATIONS: Record<string, string> = {
  unit: "unidad",
  units: "unidad",
  u: "unidad",
  un: "unidad",
  ud: "unidad",
  uds: "unidad",
  pc: "unidad",
  pcs: "unidad",
  piece: "unidad",
  pieces: "unidad",
  each: "unidad",
  ea: "unidad",
  item: "unidad",
  items: "unidad",
  hour: "hora",
  hours: "hora",
  hr: "hora",
  hrs: "hora",
  day: "día",
  days: "día",
  box: "caja",
  boxes: "caja",
  cj: "caja",
  bag: "bolsa",
  bags: "bolsa",
  meter: "metro",
  meters: "metro",
  mt: "metro",
  mts: "metro",
  liter: "litro",
  liters: "litro",
  lt: "litro",
  lts: "litro",
  service: "servicio",
  services: "servicio",
};

export function normalizeCatalogUnit(value: string | null | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return DEFAULT_CATALOG_UNIT;
  }

  const translation = UNIT_TRANSLATIONS[normalizedValue.toLowerCase()];

  return translation ?? normalizedValue;
}
