# Dashboard "Tablero visual" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar `/dashboard` como tablero visual: tarjetas con mini-tendencias (sparklines), torta de estados de cotización y el gráfico mensual existente, todo bajo un toggle Semana/Este mes.

**Architecture:** Helpers puros y testeables en `/lib` (variación %, conteo por estado, puntos de sparkline, gradiente de torta). Datos por período obtenidos server-side y pasados a un componente cliente `DashboardOverview` que es dueño del estado del período y compone `DashboardStatTiles` + `DashboardStatusDonut`. El gráfico mensual (`DashboardMonthlyChart`, ya existe) y la lista de recientes quedan fijos. Reemplaza `DashboardMetricCards` + `DashboardPeriodSummary`.

**Tech Stack:** Next.js 14 (App Router, RSC) · TypeScript · Tailwind + design tokens · recharts (ya presente, solo para el gráfico de barras) · Supabase server client · tests con `tsx --test` (`node:test` + `node:assert/strict`).

---

## File Structure

**Crear:**
- `lib/dashboard-variation.ts` — `computeVariationPercent` (puro).
- `lib/dashboard-status-counts.ts` — tipo `QuotationStatusCounts`, `bucketQuotationStatusCounts` (puro) y `getDashboardStatusCounts` (Supabase).
- `lib/sparkline-points.ts` — `buildSparklinePoints` (puro).
- `lib/donut-gradient.ts` — `buildConicGradient` (puro).
- `components/dashboard/sparkline.tsx` — SVG presentacional.
- `components/dashboard/dashboard-stat-tiles.tsx` — 4 tarjetas 2×2.
- `components/dashboard/dashboard-status-donut.tsx` — torta + leyenda.
- `components/dashboard/dashboard-overview.tsx` — cliente, dueño del período; compone toggle + tiles + donut.
- Tests: `tests/dashboard-variation.test.ts`, `tests/dashboard-status-counts.test.ts`, `tests/sparkline-points.test.ts`, `tests/donut-gradient.test.ts`.

**Modificar:**
- `types/index.ts` — agregar `accepted: number` a `DashboardMonthlyPoint`.
- `lib/dashboard-monthly.ts` — calcular `accepted` por mes.
- `lib/dashboard-period.ts` — `getDashboardPeriodSummary` acepta `now`; agregar `getPreviousPeriodNow`.
- `app/(dashboard)/dashboard/page.tsx` — fetch nuevo + render nuevo; quitar `DashboardMetricCards` y `DashboardPeriodSummary`.

**Decisión de estados (torta):** los estados canónicos son `draft/pending/accepted/rejected/expired` (`approved→accepted`, `sent→pending`). "pending" se muestra como **"Enviada"**. La tarjeta "Para seguir" = cantidad de `pending` del período. La torta muestra Enviada/Aceptada/Rechazada/Vencida (Borrador se omite por ser pre-envío).

---

### Task 1: Helper puro `computeVariationPercent`

**Files:**
- Create: `lib/dashboard-variation.ts`
- Test: `tests/dashboard-variation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/dashboard-variation.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { computeVariationPercent } from "../lib/dashboard-variation";

test("computeVariationPercent calcula la suba porcentual redondeada", () => {
  assert.equal(computeVariationPercent(112, 100), 12);
});

test("computeVariationPercent calcula la baja porcentual", () => {
  assert.equal(computeVariationPercent(90, 100), -10);
});

test("computeVariationPercent devuelve null si el período anterior es 0", () => {
  assert.equal(computeVariationPercent(500, 0), null);
});

test("computeVariationPercent devuelve null con valores no finitos", () => {
  assert.equal(computeVariationPercent(Number.NaN, 100), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dashboard-variation.test.ts`
Expected: FAIL — `Cannot find module '../lib/dashboard-variation'`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dashboard-variation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard-variation.ts tests/dashboard-variation.test.ts
git commit -m "feat(dashboard): helper de variacion porcentual entre periodos"
```

---

### Task 2: Conteo por estado (puro + fetcher)

**Files:**
- Create: `lib/dashboard-status-counts.ts`
- Test: `tests/dashboard-status-counts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/dashboard-status-counts.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  bucketQuotationStatusCounts,
  emptyQuotationStatusCounts,
} from "../lib/dashboard-status-counts";

test("bucketQuotationStatusCounts agrupa por estado y aplica alias", () => {
  const counts = bucketQuotationStatusCounts([
    "accepted",
    "approved", // alias de accepted
    "sent", // alias de pending
    "pending",
    "rejected",
    "expired",
    "draft",
    null,
    "loquesea", // estado inválido => se ignora
  ]);

  assert.deepEqual(counts, {
    accepted: 2,
    pending: 2,
    rejected: 1,
    expired: 1,
    draft: 1,
    total: 7,
  });
});

test("emptyQuotationStatusCounts arranca todo en 0", () => {
  assert.deepEqual(emptyQuotationStatusCounts(), {
    accepted: 0,
    pending: 0,
    rejected: 0,
    expired: 0,
    draft: 0,
    total: 0,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dashboard-status-counts.test.ts`
Expected: FAIL — `Cannot find module '../lib/dashboard-status-counts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/dashboard-status-counts.ts
import { getPeriodBoundaries, type DashboardPeriod } from "@/lib/dashboard-period";
import { normalizeQuotationStatus } from "@/lib/quotation-status";
import { createClient } from "@/lib/supabase/server";

export type QuotationStatusCounts = {
  accepted: number;
  pending: number;
  rejected: number;
  expired: number;
  draft: number;
  total: number;
};

export function emptyQuotationStatusCounts(): QuotationStatusCounts {
  return { accepted: 0, pending: 0, rejected: 0, expired: 0, draft: 0, total: 0 };
}

/** Agrupa una lista de estados crudos en conteos canónicos (aplica alias). */
export function bucketQuotationStatusCounts(
  statuses: (string | null)[],
): QuotationStatusCounts {
  const counts = emptyQuotationStatusCounts();

  for (const raw of statuses) {
    const status = normalizeQuotationStatus(raw);
    if (!status) {
      continue;
    }
    counts[status] += 1;
    counts.total += 1;
  }

  return counts;
}

/** Conteo de cotizaciones por estado creadas dentro del período. */
export async function getDashboardStatusCounts(
  userId: string,
  period: DashboardPeriod,
  now: Date = new Date(),
): Promise<QuotationStatusCounts> {
  const { start, end } = getPeriodBoundaries(period, now);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotations")
    .select("status")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) {
    return emptyQuotationStatusCounts();
  }

  return bucketQuotationStatusCounts(
    (data ?? []).map((row) => (row as { status: string | null }).status),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dashboard-status-counts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard-status-counts.ts tests/dashboard-status-counts.test.ts
git commit -m "feat(dashboard): conteo de cotizaciones por estado por periodo"
```

---

### Task 3: Puntos del sparkline (puro)

**Files:**
- Create: `lib/sparkline-points.ts`
- Test: `tests/sparkline-points.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sparkline-points.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildSparklinePoints } from "../lib/sparkline-points";

test("buildSparklinePoints devuelve '' con menos de 2 valores", () => {
  assert.equal(buildSparklinePoints([]), "");
  assert.equal(buildSparklinePoints([5]), "");
});

test("buildSparklinePoints reparte el ancho 0..100 y mapea min/max al alto", () => {
  // Dos puntos: x va de 0 a 100. El mínimo (0) cae abajo, el máximo (10) arriba.
  const points = buildSparklinePoints([0, 10]);
  const pairs = points.split(" ").map((p) => p.split(",").map(Number));

  assert.equal(pairs.length, 2);
  assert.equal(pairs[0][0], 0); // primer x
  assert.equal(pairs[1][0], 100); // último x
  // y del máximo es menor (más arriba) que y del mínimo
  assert.ok(pairs[1][1] < pairs[0][1]);
});

test("buildSparklinePoints con todos los valores iguales no rompe (línea plana)", () => {
  const points = buildSparklinePoints([5, 5, 5]);
  const ys = points.split(" ").map((p) => Number(p.split(",")[1]));
  assert.ok(ys.every((y) => Number.isFinite(y)));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/sparkline-points.test.ts`
Expected: FAIL — `Cannot find module '../lib/sparkline-points'`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/sparkline-points.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sparkline-points.ts tests/sparkline-points.test.ts
git commit -m "feat(dashboard): helper de puntos para sparkline SVG"
```

---

### Task 4: Gradiente de la torta (puro)

**Files:**
- Create: `lib/donut-gradient.ts`
- Test: `tests/donut-gradient.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/donut-gradient.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildConicGradient } from "../lib/donut-gradient";

test("buildConicGradient reparte los tramos proporcional al valor", () => {
  const gradient = buildConicGradient([
    { value: 1, color: "#00E5A0" },
    { value: 1, color: "#58a6ff" },
  ]);

  assert.equal(
    gradient,
    "conic-gradient(#00E5A0 0.00% 50.00%, #58a6ff 50.00% 100.00%)",
  );
});

test("buildConicGradient ignora segmentos en 0", () => {
  const gradient = buildConicGradient([
    { value: 0, color: "#00E5A0" },
    { value: 3, color: "#58a6ff" },
  ]);

  assert.equal(gradient, "conic-gradient(#58a6ff 0.00% 100.00%)");
});

test("buildConicGradient con total 0 devuelve el color de fondo", () => {
  const gradient = buildConicGradient([{ value: 0, color: "#00E5A0" }]);
  assert.equal(gradient, "rgb(var(--surface-2-rgb))");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/donut-gradient.test.ts`
Expected: FAIL — `Cannot find module '../lib/donut-gradient'`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/donut-gradient.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/donut-gradient.ts tests/donut-gradient.test.ts
git commit -m "feat(dashboard): helper de conic-gradient para la torta"
```

---

### Task 5: Serie mensual de "aceptado"

**Files:**
- Modify: `types/index.ts` (tipo `DashboardMonthlyPoint`)
- Modify: `lib/dashboard-monthly.ts:57-100` (`getDashboardMonthlyComparison`)

No tiene test unitario (es una query a Supabase, igual que el resto de `dashboard-monthly.ts`). Se verifica con `next build` y en el render.

- [ ] **Step 1: Agregar `accepted` al tipo**

En `types/index.ts`, buscar `DashboardMonthlyPoint` y dejarlo así:

```ts
export type DashboardMonthlyPoint = {
  monthLabel: string;
  quoted: number;
  expenses: number;
  accepted: number;
};
```

- [ ] **Step 2: Calcular `accepted` por mes**

En `lib/dashboard-monthly.ts`, agregar el import arriba (junto a los otros imports):

```ts
import { normalizeQuotationStatus } from "@/lib/quotation-status";
```

Reemplazar el bloque del `map` dentro de `getDashboardMonthlyComparison` (el `monthRanges.map(async (range) => { ... })`) por:

```ts
  const points = await Promise.all(
    monthRanges.map(async (range) => {
      const [quotationsResult, expensesResult] = await Promise.all([
        supabase
          .from("quotations")
          .select("total, status")
          .eq("user_id", userId)
          .gte("created_at", range.isoStart)
          .lte("created_at", range.isoEnd),
        supabase
          .from("expenses")
          .select("amount")
          .eq("user_id", userId)
          .gte("date", range.dateOnlyStart)
          .lte("date", range.dateOnlyEnd),
      ]);

      const quotationRows = quotationsResult.data ?? [];
      const quoted = quotationRows.reduce(
        (sum, row) => sum + parseAmount(row.total),
        0,
      );
      const accepted = quotationRows.reduce(
        (sum, row) =>
          normalizeQuotationStatus((row as { status: string | null }).status) ===
          "accepted"
            ? sum + parseAmount(row.total)
            : sum,
        0,
      );
      const expenses = (expensesResult.data ?? []).reduce(
        (sum, row) => sum + parseAmount(row.amount),
        0,
      );

      return {
        monthLabel: range.label,
        quoted,
        expenses,
        accepted,
      };
    }),
  );

  return points;
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (sin errores; `DashboardMonthlyChart` sigue usando `quoted`/`expenses`, el campo nuevo no rompe nada).

- [ ] **Step 4: Commit**

```bash
git add types/index.ts lib/dashboard-monthly.ts
git commit -m "feat(dashboard): serie mensual de aceptado para sparklines"
```

---

### Task 6: Período anterior + `now` opcional en el resumen

**Files:**
- Modify: `lib/dashboard-period.ts` (`getDashboardPeriodSummary`, agregar `getPreviousPeriodNow`)
- Test: `tests/dashboard-period.test.ts` (agregar casos para `getPreviousPeriodNow`)

- [ ] **Step 1: Write the failing test (agregar al final del archivo existente)**

```ts
// agregar a tests/dashboard-period.test.ts
import { getPreviousPeriodNow } from "../lib/dashboard-period";

test("getPreviousPeriodNow('month') cae en el mes anterior", () => {
  const prev = getPreviousPeriodNow("month", new Date(2026, 5, 17)); // jun 2026
  assert.equal(prev.getMonth(), 4); // mayo
  assert.equal(prev.getFullYear(), 2026);
});

test("getPreviousPeriodNow('week') resta 7 días", () => {
  const prev = getPreviousPeriodNow("week", new Date(2026, 5, 17)); // 17 jun
  assert.equal(prev.getDate(), 10); // 10 jun
  assert.equal(prev.getMonth(), 5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/dashboard-period.test.ts`
Expected: FAIL — `getPreviousPeriodNow` no existe / no exportado.

- [ ] **Step 3: Implementar**

En `lib/dashboard-period.ts`, agregar la función exportada (después de `getPeriodBoundaries`):

```ts
/** Un "ahora" que cae dentro del período anterior (para comparar variación). */
export function getPreviousPeriodNow(
  period: DashboardPeriod,
  now: Date = new Date(),
): Date {
  if (period === "week") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 7,
      12,
      0,
      0,
      0,
    );
  }

  // Día 0 del mes actual = último día del mes anterior.
  return new Date(now.getFullYear(), now.getMonth(), 0, 12, 0, 0, 0);
}
```

Y cambiar la firma de `getDashboardPeriodSummary` para aceptar `now` y pasárselo a `getPeriodBoundaries`:

```ts
export async function getDashboardPeriodSummary(
  userId: string,
  profileCurrency: string | null,
  period: DashboardPeriod,
  now: Date = new Date(),
): Promise<DashboardPeriodSummary> {
  const { start, end, startDateOnly, endDateOnly } = getPeriodBoundaries(
    period,
    now,
  );
  // ...resto del cuerpo SIN cambios...
```

(Solo cambia la firma y la primera línea; el resto del cuerpo queda igual.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/dashboard-period.test.ts`
Expected: PASS (todos, incluidos los 2 nuevos).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard-period.ts tests/dashboard-period.test.ts
git commit -m "feat(dashboard): periodo anterior y now opcional en el resumen"
```

---

### Task 7: Componente `Sparkline`

**Files:**
- Create: `components/dashboard/sparkline.tsx`

Presentacional puro (usa `buildSparklinePoints` de la Task 3). Se verifica con `next build`.

- [ ] **Step 1: Implementar**

```tsx
// components/dashboard/sparkline.tsx
import { buildSparklinePoints } from "@/lib/sparkline-points";
import { cn } from "@/lib/utils";

type SparklineProps = {
  values: number[];
  color: string;
  className?: string;
};

export function Sparkline({ values, color, className }: SparklineProps) {
  const points = buildSparklinePoints(values);

  if (!points) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className={cn("h-6 w-full", className)}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/sparkline.tsx
git commit -m "feat(dashboard): componente Sparkline"
```

---

### Task 8: Componente `DashboardStatusDonut`

**Files:**
- Create: `components/dashboard/dashboard-status-donut.tsx`

Usa `buildConicGradient` (Task 4) y `QuotationStatusCounts` (Task 2). Muestra Enviada/Aceptada/Rechazada/Vencida con sus colores y conteos; estado vacío si `total === 0`.

- [ ] **Step 1: Implementar**

```tsx
// components/dashboard/dashboard-status-donut.tsx
import { buildConicGradient } from "@/lib/donut-gradient";
import type { QuotationStatusCounts } from "@/lib/dashboard-status-counts";

type DashboardStatusDonutProps = {
  counts: QuotationStatusCounts;
};

const SEGMENTS: { key: keyof QuotationStatusCounts; label: string; color: string }[] = [
  { key: "accepted", label: "Aceptadas", color: "#00E5A0" },
  { key: "pending", label: "Enviadas", color: "#58a6ff" },
  { key: "rejected", label: "Rechazadas", color: "#f85149" },
  { key: "expired", label: "Vencidas", color: "#f0883e" },
];

export function DashboardStatusDonut({ counts }: DashboardStatusDonutProps) {
  const visible = SEGMENTS.filter((segment) => counts[segment.key] > 0);
  const gradient = buildConicGradient(
    visible.map((segment) => ({ value: counts[segment.key], color: segment.color })),
  );

  return (
    <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
      <h3 className="mb-4 text-base font-semibold tracking-tight text-foreground">
        Estados de tus cotizaciones
      </h3>

      {counts.total === 0 ? (
        <p className="rounded-md border border-dashed border-token bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay cotizaciones en este período.
        </p>
      ) : (
        <div className="flex items-center gap-5">
          <div
            className="relative h-28 w-28 shrink-0 rounded-full"
            style={{ background: gradient }}
            role="img"
            aria-label={`Estados: ${visible
              .map((segment) => `${segment.label} ${counts[segment.key]}`)
              .join(", ")}`}
          >
            <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-background">
              <span className="text-xl font-bold text-foreground">{counts.total}</span>
              <span className="text-[10px] text-muted-foreground">total</span>
            </div>
          </div>

          <ul className="flex-1 space-y-2 text-sm">
            {SEGMENTS.map((segment) => (
              <li key={segment.key} className="flex items-center gap-2 text-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: segment.color }}
                />
                <span className="text-muted-foreground">{segment.label}</span>
                <span className="ml-auto font-semibold">{counts[segment.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/dashboard-status-donut.tsx
git commit -m "feat(dashboard): torta de estados de cotizacion"
```

---

### Task 9: Componente `DashboardStatTiles`

**Files:**
- Create: `components/dashboard/dashboard-stat-tiles.tsx`

4 tarjetas 2×2: Aceptado (+sparkline +variación), Gastos (+sparkline +variación), Ganancia neta (o CTA si no se puede), Para seguir (pendientes). Usa `Sparkline`, `formatCurrencyAmount`.

- [ ] **Step 1: Implementar**

```tsx
// components/dashboard/dashboard-stat-tiles.tsx
import Link from "next/link";

import { Sparkline } from "@/components/dashboard/sparkline";
import { formatCurrencyAmount } from "@/lib/formatting";

export type StatTilesData = {
  accepted: number;
  spent: number;
  net: number;
  canCalculateNet: boolean;
  pendingCount: number;
  acceptedVariation: number | null;
  spentVariation: number | null;
};

type DashboardStatTilesProps = {
  data: StatTilesData;
  currency: string | null;
  acceptedSeries: number[];
  expensesSeries: number[];
};

function VariationText({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null || value === 0) {
    return <span className="text-xs text-muted-foreground">Sin cambios vs período anterior</span>;
  }
  const isUp = value > 0;
  const isGood = isUp === goodWhenUp;
  const color = isGood ? "text-accent-token" : "text-orange-600 dark:text-orange-300";
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {isUp ? "↑" : "↓"} {Math.abs(value)}% vs período anterior
    </span>
  );
}

export function DashboardStatTiles({
  data,
  currency,
  acceptedSeries,
  expensesSeries,
}: DashboardStatTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
        <p className="text-xs text-muted-foreground">Aceptado</p>
        <p className="mt-1 text-xl font-bold text-accent-token">
          {formatCurrencyAmount(data.accepted, currency)}
        </p>
        <VariationText value={data.acceptedVariation} goodWhenUp />
        <Sparkline values={acceptedSeries} color="rgb(var(--accent-rgb))" className="mt-2 h-6 w-full" />
      </div>

      <div className="rounded-2xl border border-token bg-background/75 p-4">
        <p className="text-xs text-muted-foreground">Gastos</p>
        <p className="mt-1 text-xl font-bold text-foreground">
          {formatCurrencyAmount(data.spent, currency)}
        </p>
        <VariationText value={data.spentVariation} goodWhenUp={false} />
        <Sparkline values={expensesSeries} color="#f97316" className="mt-2 h-6 w-full" />
      </div>

      <div className="rounded-2xl border border-token bg-background/75 p-4">
        <p className="text-xs text-muted-foreground">Ganancia neta</p>
        {data.canCalculateNet ? (
          <p className="mt-1 text-xl font-bold text-accent-token">
            {formatCurrencyAmount(data.net, currency)}
          </p>
        ) : (
          <Link href="/gastos" className="mt-1 inline-block text-sm font-medium text-accent-token">
            Registrá gastos para verla →
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-token bg-background/75 p-4">
        <p className="text-xs text-muted-foreground">Para seguir</p>
        <p className="mt-1 text-3xl font-bold leading-none text-foreground">
          {data.pendingCount}
        </p>
        <p className="mt-1 text-xs font-medium text-orange-600 dark:text-orange-300">
          {data.pendingCount === 1 ? "cotización pendiente" : "cotizaciones pendientes"}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/dashboard-stat-tiles.tsx
git commit -m "feat(dashboard): tarjetas de stats con sparklines"
```

---

### Task 10: Componente `DashboardOverview` (cliente, dueño del período)

**Files:**
- Create: `components/dashboard/dashboard-overview.tsx`

Tiene el toggle Semana/Mes (mismo patrón que el `DashboardPeriodSummary` actual) y, según el período activo, pasa los datos a `DashboardStatTiles` + `DashboardStatusDonut`. Las series del sparkline son compartidas (6 meses, no dependen del toggle).

- [ ] **Step 1: Implementar**

```tsx
// components/dashboard/dashboard-overview.tsx
"use client";

import { useState } from "react";

import {
  DashboardStatTiles,
  type StatTilesData,
} from "@/components/dashboard/dashboard-stat-tiles";
import { DashboardStatusDonut } from "@/components/dashboard/dashboard-status-donut";
import type { QuotationStatusCounts } from "@/lib/dashboard-status-counts";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { cn } from "@/lib/utils";

type PeriodBundle = {
  tiles: StatTilesData;
  statusCounts: QuotationStatusCounts;
};

type DashboardOverviewProps = {
  week: PeriodBundle;
  month: PeriodBundle;
  currency: string | null;
  acceptedSeries: number[];
  expensesSeries: number[];
};

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: "week", label: "Semana" },
  { id: "month", label: "Este mes" },
];

export function DashboardOverview({
  week,
  month,
  currency,
  acceptedSeries,
  expensesSeries,
}: DashboardOverviewProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const active = period === "week" ? week : month;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight">Tu mes de un vistazo</h3>
        <div
          role="tablist"
          aria-label="Período del tablero"
          className="inline-flex rounded-full border border-token bg-background/75 p-1"
        >
          {PERIOD_OPTIONS.map((option) => {
            const selected = option.id === period;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setPeriod(option.id)}
                className={cn(
                  "min-h-9 rounded-full px-4 text-sm font-medium transition",
                  selected
                    ? "bg-accent-token text-black"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <DashboardStatTiles
        data={active.tiles}
        currency={currency}
        acceptedSeries={acceptedSeries}
        expensesSeries={expensesSeries}
      />

      <DashboardStatusDonut counts={active.statusCounts} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/dashboard-overview.tsx
git commit -m "feat(dashboard): DashboardOverview con toggle de periodo"
```

---

### Task 11: Cablear el dashboard

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

Reemplaza `DashboardMetricCards` + `DashboardPeriodSummary` por `DashboardOverview`, renderiza `DashboardMonthlyChart` (6 meses) y mantiene la lista de recientes.

- [ ] **Step 1: Reescribir la cabecera de imports y el fetch**

Reemplazar el bloque de imports + el cuerpo de `DashboardPage` (hasta justo antes del `return`) por:

```tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { DashboardMonthlyChart } from "@/components/dashboard/dashboard-monthly-chart";
import { EMPTY_DASHBOARD_STATS, getDashboardStats } from "@/lib/dashboard";
import {
  getDashboardPeriodSummary,
  getPreviousPeriodNow,
  type DashboardPeriodSummary as PeriodSummary,
} from "@/lib/dashboard-period";
import {
  emptyQuotationStatusCounts,
  getDashboardStatusCounts,
} from "@/lib/dashboard-status-counts";
import { computeVariationPercent } from "@/lib/dashboard-variation";
import { formatDisplayName } from "@/lib/entity-normalization";
import { formatCurrencyAmount, formatDateTime } from "@/lib/formatting";
import { getProfile, requireUser } from "@/lib/profile";
import { getQuotations } from "@/lib/quotations";
import {
  formatQuotationStatusLabel,
  getQuotationStatusBadgeClassName,
} from "@/lib/quotation-status";
import { cn } from "@/lib/utils";

const EMPTY_PERIOD_SUMMARY: PeriodSummary = {
  accepted: 0,
  spent: 0,
  net: 0,
  canCalculateNet: false,
};

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const currency = profile?.currency ?? null;
  const prevWeekNow = getPreviousPeriodNow("week");
  const prevMonthNow = getPreviousPeriodNow("month");

  const [
    stats,
    quotations,
    weekSummary,
    monthSummary,
    prevWeekSummary,
    prevMonthSummary,
    weekStatus,
    monthStatus,
  ] = await Promise.all([
    getDashboardStats(user.id, currency).catch(() => EMPTY_DASHBOARD_STATS),
    getQuotations(user.id, { limit: 5 }).catch(() => []),
    getDashboardPeriodSummary(user.id, currency, "week").catch(() => EMPTY_PERIOD_SUMMARY),
    getDashboardPeriodSummary(user.id, currency, "month").catch(() => EMPTY_PERIOD_SUMMARY),
    getDashboardPeriodSummary(user.id, currency, "week", prevWeekNow).catch(() => EMPTY_PERIOD_SUMMARY),
    getDashboardPeriodSummary(user.id, currency, "month", prevMonthNow).catch(() => EMPTY_PERIOD_SUMMARY),
    getDashboardStatusCounts(user.id, "week").catch(() => emptyQuotationStatusCounts()),
    getDashboardStatusCounts(user.id, "month").catch(() => emptyQuotationStatusCounts()),
  ]);

  const acceptedSeries = stats.monthlyComparison.map((point) => point.accepted);
  const expensesSeries = stats.monthlyComparison.map((point) => point.expenses);

  const weekBundle = {
    tiles: {
      accepted: weekSummary.accepted,
      spent: weekSummary.spent,
      net: weekSummary.net,
      canCalculateNet: weekSummary.canCalculateNet,
      pendingCount: weekStatus.pending,
      acceptedVariation: computeVariationPercent(weekSummary.accepted, prevWeekSummary.accepted),
      spentVariation: computeVariationPercent(weekSummary.spent, prevWeekSummary.spent),
    },
    statusCounts: weekStatus,
  };
  const monthBundle = {
    tiles: {
      accepted: monthSummary.accepted,
      spent: monthSummary.spent,
      net: monthSummary.net,
      canCalculateNet: monthSummary.canCalculateNet,
      pendingCount: monthStatus.pending,
      acceptedVariation: computeVariationPercent(monthSummary.accepted, prevMonthSummary.accepted),
      spentVariation: computeVariationPercent(monthSummary.spent, prevMonthSummary.spent),
    },
    statusCounts: monthStatus,
  };

  const recentQuotations = quotations.slice(0, 5);
  const greetingName =
    formatDisplayName(profile?.first_name ?? null) ||
    formatDisplayName(profile?.business_name ?? null) ||
    null;

  const panelClassName = "shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6";
  const statCardClassName = "!rounded-md !border-token !bg-background/75 !shadow-none";
```

- [ ] **Step 2: Reemplazar el JSX del return**

Reemplazar el `return ( ... )` completo por:

```tsx
  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className={panelClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-tight">
              {greetingName ? `Hola, ${greetingName} 👋` : "Hola 👋"}
            </h3>
            <p className="text-sm text-muted-foreground">Así va tu negocio</p>
          </div>
          <Button asChild variant="outline" className="min-h-12 bg-background/75">
            <Link href="/cotizaciones">Ver mis cotizaciones</Link>
          </Button>
        </div>
      </section>

      <DashboardOverview
        week={weekBundle}
        month={monthBundle}
        currency={currency}
        acceptedSeries={acceptedSeries}
        expensesSeries={expensesSeries}
      />

      <section className={panelClassName}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight">Cotizado vs gastos</h3>
          <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
        </div>
        <DashboardMonthlyChart data={stats.monthlyComparison} currency={currency} />
      </section>

      <section className={panelClassName}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-tight">Cotizaciones recientes</h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Tus últimas cotizaciones de un vistazo.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-12 bg-background/75">
            <Link href="/cotizaciones">Ver todas</Link>
          </Button>
        </div>

        {recentQuotations.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">
              Hagamos tu primera cotización
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Es rápido y queda con tu logo. La armás y se la mandás a tu cliente por WhatsApp.
            </p>
            <div className="mt-6 flex justify-center">
              <Button asChild className="min-h-12">
                <Link href="/cotizaciones/nueva">Crear mi primera cotización</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {recentQuotations.map((quotation) => (
              <Card key={quotation.id} className={cn(statCardClassName, "!bg-background/80")}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {quotation.number}
                      </span>
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getQuotationStatusBadgeClassName(
                          quotation.status,
                        )}`}
                      >
                        {formatQuotationStatusLabel(quotation.status)}
                      </span>
                    </div>
                    <div>
                      <p className="break-words text-lg font-semibold text-foreground">
                        {formatDisplayName(quotation.client_name) || "Cliente sin asignar"}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Creada el {formatDateTime(quotation.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrencyAmount(quotation.total, currency)}
                    </p>
                    <Button asChild variant="outline" className="bg-background/75">
                      <Link href={`/cotizaciones/${quotation.id}`}>Ver detalle</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck + lint**

Run: `npx tsc --noEmit && npx next lint --file app/(dashboard)/dashboard/page.tsx`
Expected: exit 0, sin warnings. (Si `DashboardMetricCards`/`DashboardPeriodSummary` quedan importados sin usar en otro lado, eliminarlos.)

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): tablero visual (tiles + torta + grafico mensual)"
```

---

### Task 12: Verificación final + limpieza

**Files:**
- (Posible) Delete: `components/dashboard/dashboard-metric-cards.tsx`, `components/dashboard/dashboard-period-summary.tsx` si ya no se usan en ningún lado.

- [ ] **Step 1: Buscar usos residuales de los componentes viejos**

Run: `grep -rn "DashboardMetricCards\|DashboardPeriodSummary" app components` (excluyendo los archivos de su propia definición)
Expected: sin resultados fuera de sus archivos. Si aparecen, migrarlos o quitarlos. Si NO se usan en ningún otro lado, borrar los 2 archivos y sus imports.

- [ ] **Step 2: Correr toda la batería de tests**

Run: `npm test`
Expected: PASS — incluidos `dashboard-variation`, `dashboard-status-counts`, `sparkline-points`, `donut-gradient`, `dashboard-period`. (Nota: el repo tiene tests que ya fallaban de antes; verificar que los nuevos pasan y no se rompió ninguno que pasaba.)

- [ ] **Step 3: Build de producción**

Run: `npm run build`
Expected: exit 0, todas las rutas compilan (incluida `/dashboard`).

- [ ] **Step 4: Commit (si hubo borrado/ajustes)**

```bash
git add -A
git commit -m "chore(dashboard): quitar metric-cards y period-summary viejos"
```

---

## Self-Review

**Spec coverage:**
- Toggle Semana/Mes → Task 10 (`DashboardOverview`). ✅
- 4 tarjetas (Aceptado+sparkline, Gastos+sparkline, Ganancia/CTA, Pendientes) → Task 9. ✅
- Sparklines (datos) → Tasks 3, 5, 7 + serie aceptado Task 5/datos. ✅
- Torta de estados → Tasks 4, 8 + datos Task 2. ✅
- Gráfico mensual fijo 6 meses → Task 11 (render de `DashboardMonthlyChart`). ✅
- Recientes → Task 11 (se mantiene). ✅
- Variación % en /lib → Task 1, usada en Task 11. ✅
- Reemplazar metric-cards + period-summary → Task 11/12. ✅
- Regla "ganancia neta solo si gastos > 0" → Task 9 (`canCalculateNet` + CTA). ✅
- Fallback sparkline aceptado → la serie sale de `monthlyComparison.accepted`; si quedara en 0, `buildSparklinePoints` devuelve línea plana válida (no rompe). ✅
- Fuera de alcance (tap-navegar, tooltips, animaciones, libs nuevas) → respetado (CSS conic + SVG, sin recharts salvo el gráfico ya existente). ✅

**Placeholder scan:** sin TODO/TBD; todo el código está completo. ✅

**Type consistency:** `QuotationStatusCounts` (Task 2) se usa en Tasks 8/10/11; `StatTilesData` (Task 9) en Tasks 10/11; `DashboardMonthlyPoint.accepted` (Task 5) en Task 11; `getPreviousPeriodNow`/`now` (Task 6) en Task 11. Nombres consistentes. ✅
