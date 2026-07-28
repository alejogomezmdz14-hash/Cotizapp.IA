// Helpers de tiempo en horario de Argentina (UTC-3, sin DST desde 2009).
//
// Motivo: en Vercel el runtime corre en UTC. Calcular "este mes" u "hoy" con
// getUTCMonth()/getUTCDate() mostraba plata y fechas del período equivocado
// cerca de medianoche argentina (de ~21 hs en adelante ya es el día/mes siguiente
// en UTC). Estos helpers fijan el cálculo al calendario argentino.

const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";
const AR_OFFSET_HOURS = 3; // Argentina es UTC-3 todo el año.

/** Año y mes (1-12) actuales en horario de Argentina. */
export function getArgentinaYearMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return { year, month };
}

/** "Hoy" en horario de Argentina como YYYY-MM-DD (en-CA emite ese formato). */
export function getArgentinaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Límites del mes argentino para columnas DATE (calendario), como YYYY-MM-DD.
 * `monthsAgo` corre hacia atrás desde el mes actual argentino.
 */
export function getArgentinaMonthDateBounds(
  monthsAgo = 0,
  now: Date = new Date(),
) {
  const { year, month } = getArgentinaYearMonth(now);
  const monthIndex = month - 1 - monthsAgo; // Date.UTC normaliza overflow/negativos.
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const nextFirst = new Date(Date.UTC(year, monthIndex + 1, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    monthStart: first.toISOString().slice(0, 10),
    nextMonthStart: nextFirst.toISOString().slice(0, 10),
    monthEnd: last.toISOString().slice(0, 10),
  };
}

/**
 * Límites del mes argentino para columnas timestamptz (instantes), como ISO UTC.
 * `isoStart` = 00:00 ART del 1°; `isoEnd` = último ms del mes; `isoNextStart` = 00:00
 * ART del 1° del mes siguiente (exclusivo). `monthLabelDate` sirve para etiquetar.
 */
export function getArgentinaMonthInstantBounds(
  monthsAgo = 0,
  now: Date = new Date(),
) {
  const { year, month } = getArgentinaYearMonth(now);
  const monthIndex = month - 1 - monthsAgo;
  const start = new Date(Date.UTC(year, monthIndex, 1, AR_OFFSET_HOURS));
  const nextStart = new Date(Date.UTC(year, monthIndex + 1, 1, AR_OFFSET_HOURS));
  const end = new Date(nextStart.getTime() - 1);
  return {
    isoStart: start.toISOString(),
    isoEnd: end.toISOString(),
    isoNextStart: nextStart.toISOString(),
    monthLabelDate: new Date(Date.UTC(year, monthIndex, 1)),
  };
}
