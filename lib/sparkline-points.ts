// lib/sparkline-points.ts
/**
 * Genera el atributo `points` de un <polyline> SVG en un viewBox 100x24.
 * Devuelve "" si hay menos de 2 valores (no hay línea que dibujar).
 */
export function buildSparklinePoints(values: number[]): string {
  if (values.length < 2) {
    return "";
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      // 1px de margen arriba y abajo dentro del alto de 24.
      const y = 23 - ((value - min) / range) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
