// lib/dashboard-variation.ts
/**
 * Variación porcentual del período actual vs el anterior, redondeada a entero.
 * Devuelve null si no se puede calcular (período anterior 0 o valores inválidos),
 * para que la UI no muestre un porcentaje sin sentido.
 */
export function computeVariationPercent(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return null;
  }

  return Math.round(((current - previous) / previous) * 100);
}
