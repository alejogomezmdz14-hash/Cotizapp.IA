// lib/donut-gradient.ts
export type DonutSegment = { value: number; color: string };

/**
 * Construye el `conic-gradient(...)` de la torta a partir de segmentos.
 * Si el total es 0 devuelve un color de relleno neutro (sin datos).
 */
export function buildConicGradient(segments: DonutSegment[]): string {
  const total = segments.reduce(
    (sum, segment) => sum + Math.max(0, segment.value),
    0,
  );

  if (total <= 0) {
    return "rgb(var(--surface-2-rgb))";
  }

  let acc = 0;
  const stops: string[] = [];

  for (const segment of segments) {
    const value = Math.max(0, segment.value);
    if (value <= 0) {
      continue;
    }
    const start = (acc / total) * 100;
    acc += value;
    const end = (acc / total) * 100;
    stops.push(`${segment.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}
