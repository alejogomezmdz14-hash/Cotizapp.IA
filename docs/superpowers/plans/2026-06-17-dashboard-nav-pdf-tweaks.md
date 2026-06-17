# Ajustes de dashboard, navegación móvil y etiqueta del PDF — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar la etiqueta "Facturar a" del PDF por "Cliente", agregar "Inicio" a la barra de navegación móvil, y darle al resumen del dashboard un selector de período "Esta semana / Este mes".

**Architecture:** Tres cambios independientes. (1) Texto puro en el PDF. (2) Refactor chico de `nav-items.ts` para exponer `bottomNavItems` y usarlo en la barra móvil. (3) Nuevo módulo `lib/dashboard-period.ts` con lógica pura testeable (límites de período + cálculo del resumen) más una query Supabase; un componente cliente togglea entre el resumen semanal y mensual ya precalculados en el server.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase JS, Tailwind, tests con `node:test` vía `tsx --test`.

**Nota de entorno:** Se trabaja sobre `main` (el flujo del proyecto). No hay cambios de base de datos en este plan. Spec aprobado: `docs/superpowers/specs/2026-06-17-dashboard-nav-pdf-tweaks-design.md`.

---

## Mapa de archivos

- Modificar: `components/cotizacion/quotation-pdf-template.tsx` — etiqueta del PDF.
- Modificar: `components/profile/pdf-template-settings.tsx` — misma etiqueta en la preview.
- Modificar: `components/layout/nav-items.ts` — exportar `bottomNavItems`.
- Modificar: `components/layout/bottom-nav.tsx` — usar `bottomNavItems` (7 ítems).
- Crear: `tests/nav-items.test.ts` — test de `bottomNavItems`.
- Crear: `lib/dashboard-period.ts` — `getPeriodBoundaries`, `summarizeDashboardPeriod`, `getDashboardPeriodSummary`.
- Crear: `tests/dashboard-period.test.ts` — tests de las funciones puras.
- Crear: `components/dashboard/dashboard-period-summary.tsx` — componente cliente con el toggle.
- Modificar: `app/(dashboard)/dashboard/page.tsx` — calcular ambos períodos y renderizar el componente.
- Crear: `tests/dashboard-period-page.test.ts` — test de cableado (regex sobre la page).

---

## Task 1: Cambiar "Facturar a" → "Cliente" en el PDF

**Files:**
- Modify: `components/cotizacion/quotation-pdf-template.tsx` (~línea 450)
- Modify: `components/profile/pdf-template-settings.tsx` (~línea 95)

- [ ] **Step 1: Confirmar que no haya tests que dependan del texto**

Run: `cd cotizapp && npx tsx --test 2>&1 | grep -i "facturar" || echo "sin referencias en tests"`
Expected: imprime "sin referencias en tests" (la cadena solo vive en los dos componentes).

- [ ] **Step 2: Reemplazar la etiqueta en el PDF real**

En `components/cotizacion/quotation-pdf-template.tsx`, cambiar el texto visible de la etiqueta del cliente:

```tsx
<Text style={styles.clientLabel}>Cliente</Text>
```

(antes decía `Facturar a`). No tocar `styles.clientLabel` ni el bloque que lo rodea.

- [ ] **Step 3: Reemplazar la etiqueta en la preview de ajustes**

En `components/profile/pdf-template-settings.tsx`, cambiar la misma etiqueta:

```tsx
Cliente
```

(donde antes decía `Facturar a`). Solo el texto.

- [ ] **Step 4: Verificar que no quede ninguna ocurrencia de "Facturar a"**

Run: `cd cotizapp && grep -rn "Facturar a" components/ app/ lib/ || echo "OK sin ocurrencias"`
Expected: imprime "OK sin ocurrencias".

- [ ] **Step 5: Typecheck**

Run: `cd cotizapp && npx tsc --noEmit`
Expected: sin salida, exit 0.

- [ ] **Step 6: Commit**

```bash
cd cotizapp && git add components/cotizacion/quotation-pdf-template.tsx components/profile/pdf-template-settings.tsx && git commit -m "fix(pdf): etiqueta del cliente dice 'Cliente' en vez de 'Facturar a'

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Agregar "Inicio" a la barra de navegación móvil

**Files:**
- Modify: `components/layout/nav-items.ts`
- Modify: `components/layout/bottom-nav.tsx`
- Test: `tests/nav-items.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/nav-items.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { bottomNavItems } from "../components/layout/nav-items";

test("bottomNavItems incluye Inicio como primer ítem", () => {
  assert.equal(bottomNavItems[0]?.href, "/dashboard");
  assert.equal(bottomNavItems[0]?.label, "Inicio");
});

test("bottomNavItems expone 7 destinos en la barra móvil", () => {
  assert.equal(bottomNavItems.length, 7);
  assert.deepEqual(
    bottomNavItems.map((item) => item.href),
    [
      "/dashboard",
      "/clientes",
      "/cotizaciones",
      "/cotizaciones/nueva",
      "/gastos",
      "/chat",
      "/catalogo",
    ],
  );
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `cd cotizapp && npx tsx --test tests/nav-items.test.ts`
Expected: FAIL — `bottomNavItems` no existe / es undefined.

- [ ] **Step 3: Exportar `bottomNavItems` en nav-items.ts**

En `components/layout/nav-items.ts`, agregar después de la definición de `sidebarNavItems`:

```ts
export const bottomNavItems = [
  dashboardNavItem,
  ...primaryNavItems,
] as const satisfies readonly NavItem[];
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `cd cotizapp && npx tsx --test tests/nav-items.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Usar `bottomNavItems` en la barra móvil**

En `components/layout/bottom-nav.tsx`:

1. Cambiar el import:

```tsx
import {
  getActiveNavHref,
  bottomNavItems,
} from "@/components/layout/nav-items";
```

2. Cambiar la fuente de datos del activo:

```tsx
const activeHref = getActiveNavHref(pathname, bottomNavItems);
```

3. Cambiar el grid de 6 a 7 columnas y achicar levemente el texto para que entren los 7 íconos. La `<ul>` queda:

```tsx
<ul
  className="grid h-[4.5rem] grid-cols-7 items-stretch"
  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
>
  {bottomNavItems.map((item) => {
```

4. En el `<Link>`, bajar el tamaño de fuente de `text-[11px]` a `text-[10px]`:

```tsx
className={cn(
  "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition",
  isPrimary
    ? "-mt-3 rounded-t-2xl bg-accent-token pt-2 text-black shadow-[0_-4px_16px_rgb(var(--accent-rgb)/0.35)]"
    : active
      ? "text-foreground"
      : "text-muted-foreground hover:text-foreground",
  isPrimary && "min-h-[4.5rem]",
)}
```

No cambiar la lógica de `isPrimary` ni el label especial (`isPrimary ? "Nuevo" : item.href === "/chat" ? "Chat" : item.label`). "Inicio" usa su `label` normal.

- [ ] **Step 6: Typecheck + lint**

Run: `cd cotizapp && npx tsc --noEmit && npm run lint`
Expected: sin errores, exit 0.

- [ ] **Step 7: Commit**

```bash
cd cotizapp && git add components/layout/nav-items.ts components/layout/bottom-nav.tsx tests/nav-items.test.ts && git commit -m "feat(nav): boton Inicio en la barra movil

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Capa de datos del resumen por período

**Files:**
- Create: `lib/dashboard-period.ts`
- Test: `tests/dashboard-period.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/dashboard-period.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  getPeriodBoundaries,
  summarizeDashboardPeriod,
} from "../lib/dashboard-period";

test("getPeriodBoundaries('month') cubre del día 1 al último del mes", () => {
  const { start, end, startDateOnly, endDateOnly } = getPeriodBoundaries(
    "month",
    new Date(2026, 5, 17), // 17 jun 2026, hora local
  );

  assert.equal(start.getDate(), 1);
  assert.equal(start.getMonth(), 5);
  assert.equal(start.getHours(), 0);
  assert.equal(end.getDate(), 30);
  assert.equal(end.getMonth(), 5);
  assert.equal(startDateOnly, "2026-06-01");
  assert.equal(endDateOnly, "2026-06-30");
});

test("getPeriodBoundaries('week') va de lunes a domingo y contiene el día actual", () => {
  const now = new Date(2026, 5, 17, 15, 0, 0); // miércoles 17 jun 2026
  const { start, end } = getPeriodBoundaries("week", now);

  assert.equal(start.getDay(), 1); // lunes
  assert.equal(end.getDay(), 0); // domingo
  assert.equal(start.getDate(), 15);
  assert.equal(end.getDate(), 21);
  assert.equal(start.getHours(), 0);
  assert.ok(start.getTime() <= now.getTime());
  assert.ok(now.getTime() <= end.getTime());
});

test("getPeriodBoundaries('week') con domingo arranca el lunes anterior", () => {
  const sunday = new Date(2026, 5, 21, 10, 0, 0); // domingo 21 jun 2026
  const { start, end } = getPeriodBoundaries("week", sunday);

  assert.equal(start.getDay(), 1);
  assert.equal(start.getDate(), 15);
  assert.equal(end.getDate(), 21);
});

test("summarizeDashboardPeriod calcula neto con una sola moneda que coincide con el perfil", () => {
  const summary = summarizeDashboardPeriod({
    acceptedTotal: 1000,
    expenses: [
      { amount: 200, currency: "ARS" },
      { amount: 100, currency: "ARS" },
    ],
    profileCurrency: "ARS",
  });

  assert.deepEqual(summary, {
    accepted: 1000,
    spent: 300,
    net: 700,
    canCalculateNet: true,
  });
});

test("summarizeDashboardPeriod no calcula neto con múltiples monedas", () => {
  const summary = summarizeDashboardPeriod({
    acceptedTotal: 1000,
    expenses: [
      { amount: 200, currency: "ARS" },
      { amount: 50, currency: "USD" },
    ],
    profileCurrency: "ARS",
  });

  assert.equal(summary.canCalculateNet, false);
  assert.equal(summary.net, 0);
  assert.equal(summary.accepted, 1000);
});

test("summarizeDashboardPeriod sin gastos deja neto en 0", () => {
  const summary = summarizeDashboardPeriod({
    acceptedTotal: 500,
    expenses: [],
    profileCurrency: "ARS",
  });

  assert.deepEqual(summary, {
    accepted: 500,
    spent: 0,
    net: 0,
    canCalculateNet: false,
  });
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `cd cotizapp && npx tsx --test tests/dashboard-period.test.ts`
Expected: FAIL — el módulo `lib/dashboard-period` no existe.

- [ ] **Step 3: Implementar `lib/dashboard-period.ts`**

Crear `lib/dashboard-period.ts`:

```ts
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import { createClient } from "@/lib/supabase/server";

export type DashboardPeriod = "week" | "month";

export type DashboardPeriodSummary = {
  accepted: number;
  spent: number;
  net: number;
  canCalculateNet: boolean;
};

export type DashboardPeriodBoundaries = {
  start: Date;
  end: Date;
  startDateOnly: string;
  endDateOnly: string;
};

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPeriodBoundaries(
  period: DashboardPeriod,
  now: Date = new Date(),
): DashboardPeriodBoundaries {
  if (period === "week") {
    // getDay(): 0=domingo..6=sábado. Queremos arrancar el lunes.
    const diffToMonday = (now.getDay() + 6) % 7;
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - diffToMonday,
      0,
      0,
      0,
      0,
    );
    const end = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + 6,
      23,
      59,
      59,
      999,
    );
    return {
      start,
      end,
      startDateOnly: toDateOnly(start),
      endDateOnly: toDateOnly(end),
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return {
    start,
    end,
    startDateOnly: toDateOnly(start),
    endDateOnly: toDateOnly(end),
  };
}

function parseAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function summarizeDashboardPeriod(input: {
  acceptedTotal: number;
  expenses: { amount: number; currency: string | null }[];
  profileCurrency: string | null;
}): DashboardPeriodSummary {
  const totalsByCurrency = new Map<string, number>();

  for (const expense of input.expenses) {
    const currency = normalizeExpenseCurrency(expense.currency);
    totalsByCurrency.set(
      currency,
      (totalsByCurrency.get(currency) ?? 0) + parseAmount(expense.amount),
    );
  }

  const entries = [...totalsByCurrency.entries()];
  const spent = entries[0]?.[1] ?? 0;
  const normalizedProfileCurrency = normalizeExpenseCurrency(
    input.profileCurrency,
  );
  const canCalculateNet =
    entries.length === 1 && entries[0]?.[0] === normalizedProfileCurrency;
  const net = canCalculateNet ? input.acceptedTotal - spent : 0;

  return {
    accepted: input.acceptedTotal,
    spent,
    net,
    canCalculateNet,
  };
}

export async function getDashboardPeriodSummary(
  userId: string,
  profileCurrency: string | null,
  period: DashboardPeriod,
): Promise<DashboardPeriodSummary> {
  const { start, end, startDateOnly, endDateOnly } = getPeriodBoundaries(period);
  const supabase = await createClient();

  const [acceptedResult, expensesResult] = await Promise.all([
    supabase
      .from("quotations")
      .select("total")
      .eq("user_id", userId)
      .in("status", ["accepted", "approved"])
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString()),
    supabase
      .from("expenses")
      .select("amount, currency")
      .eq("user_id", userId)
      .gte("date", startDateOnly)
      .lte("date", endDateOnly),
  ]);

  const acceptedTotal = (acceptedResult.data ?? []).reduce(
    (sum, row) => sum + parseAmount(row.total),
    0,
  );
  const expenses = (expensesResult.data ?? []).map((row) => ({
    amount: parseAmount((row as { amount: unknown }).amount),
    currency: (row as { currency: string | null }).currency ?? null,
  }));

  return summarizeDashboardPeriod({ acceptedTotal, expenses, profileCurrency });
}
```

- [ ] **Step 4: Correr los tests para verlos pasar**

Run: `cd cotizapp && npx tsx --test tests/dashboard-period.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `cd cotizapp && npx tsc --noEmit`
Expected: sin salida, exit 0.

- [ ] **Step 6: Commit**

```bash
cd cotizapp && git add lib/dashboard-period.ts tests/dashboard-period.test.ts && git commit -m "feat(dashboard): capa de datos del resumen por periodo (semana/mes)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Componente con selector de período + cableado en el dashboard

**Files:**
- Create: `components/dashboard/dashboard-period-summary.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Test: `tests/dashboard-period-page.test.ts`

- [ ] **Step 1: Escribir el test de cableado (falla)**

Crear `tests/dashboard-period-page.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("DashboardPage usa getDashboardPeriodSummary para semana y mes", async () => {
  const source = await readFile(
    new URL("../app/(dashboard)/dashboard/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /getDashboardPeriodSummary/);
  assert.match(source, /"week"/);
  assert.match(source, /"month"/);
  assert.match(source, /<DashboardPeriodSummary[\s\S]*week=\{[\s\S]*month=\{/);
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `cd cotizapp && npx tsx --test tests/dashboard-period-page.test.ts`
Expected: FAIL — la page todavía no referencia `getDashboardPeriodSummary` ni `<DashboardPeriodSummary`.

- [ ] **Step 3: Crear el componente cliente**

Crear `components/dashboard/dashboard-period-summary.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import {
  type DashboardPeriod,
  type DashboardPeriodSummary as PeriodSummary,
} from "@/lib/dashboard-period";
import { formatCurrencyAmount } from "@/lib/formatting";
import { cn } from "@/lib/utils";

type DashboardPeriodSummaryProps = {
  week: PeriodSummary;
  month: PeriodSummary;
  currency: string | null;
};

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mes" },
];

export function DashboardPeriodSummary({
  week,
  month,
  currency,
}: DashboardPeriodSummaryProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const active = period === "week" ? week : month;
  const spentRatio =
    active.accepted > 0
      ? Math.min(100, Math.round((active.spent / active.accepted) * 100))
      : 0;

  return (
    <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-semibold tracking-tight">
          Resumen del período
        </h3>
        <div
          role="tablist"
          aria-label="Período del resumen"
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
          <p className="text-sm text-muted-foreground">Aceptado</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrencyAmount(active.accepted, currency)}
          </p>
        </div>
        <div className="rounded-md border border-orange-500/30 bg-orange-500/8 p-4">
          <p className="text-sm text-muted-foreground">Gastado</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrencyAmount(active.spent, currency)}
          </p>
        </div>
        <div className="rounded-md border border-token bg-background/75 p-4">
          <p className="text-sm text-muted-foreground">Ganancia neta</p>
          {active.canCalculateNet ? (
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatCurrencyAmount(active.net, currency)}
            </p>
          ) : (
            <Link
              href="/gastos"
              className="mt-2 inline-block text-sm font-medium text-accent-token"
            >
              Registrá gastos para verla →
            </Link>
          )}
        </div>
      </div>

      {active.accepted > 0 && active.canCalculateNet ? (
        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn("h-full rounded-full bg-orange-500/70")}
              style={{ width: `${spentRatio}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Gastaste el {spentRatio}% de lo que aceptaste{" "}
            {period === "week" ? "esta semana" : "este mes"}.
          </p>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Cablear el componente en la page del dashboard**

En `app/(dashboard)/dashboard/page.tsx`:

1. Agregar imports (junto a los existentes):

```tsx
import { DashboardPeriodSummary } from "@/components/dashboard/dashboard-period-summary";
import {
  getDashboardPeriodSummary,
  type DashboardPeriodSummary as PeriodSummary,
} from "@/lib/dashboard-period";
```

2. Definir un fallback de período vacío (arriba del componente, debajo de los imports):

```tsx
const EMPTY_PERIOD_SUMMARY: PeriodSummary = {
  accepted: 0,
  spent: 0,
  net: 0,
  canCalculateNet: false,
};
```

3. Reemplazar el bloque de fetch `const [stats, quotations] = await Promise.all([...])` por uno que también traiga los dos resúmenes de período:

```tsx
const [stats, quotations, weekSummary, monthSummary] = await Promise.all([
  getDashboardStats(user.id, currency).catch(() => EMPTY_DASHBOARD_STATS),
  getQuotations(user.id, { limit: 5 }).catch(() => []),
  getDashboardPeriodSummary(user.id, currency, "week").catch(
    () => EMPTY_PERIOD_SUMMARY,
  ),
  getDashboardPeriodSummary(user.id, currency, "month").catch(
    () => EMPTY_PERIOD_SUMMARY,
  ),
]);
```

4. Borrar las variables que ya no se usan (las calculaba el resumen inline): `monthLabel`, `acceptedThisMonth`, `spentThisMonth`, `hasExpensesThisMonth`, `spentRatio`. (Dejar `panelClassName` y `statCardClassName`.)

5. Reemplazar TODA la `<section>` del resumen mensual (la que tiene el `<h3>Resumen del mes</h3>` y las tarjetas Aceptado/Gastado/Ganancia neta, incluida la barra de ratio) por:

```tsx
<DashboardPeriodSummary
  week={weekSummary}
  month={monthSummary}
  currency={currency}
/>
```

No tocar la primera `<section>` (saludo + `DashboardMetricCards`) ni la tercera (`Cotizaciones recientes`).

- [ ] **Step 5: Correr el test de cableado para verlo pasar**

Run: `cd cotizapp && npx tsx --test tests/dashboard-period-page.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Typecheck + lint (atrapa variables sin usar)**

Run: `cd cotizapp && npx tsc --noEmit && npm run lint`
Expected: sin errores, exit 0. (Si lint marca una variable sin usar, es alguna de las del Step 4 punto 4 que quedó sin borrar.)

- [ ] **Step 7: Commit**

```bash
cd cotizapp && git add components/dashboard/dashboard-period-summary.tsx "app/(dashboard)/dashboard/page.tsx" tests/dashboard-period-page.test.ts && git commit -m "feat(dashboard): selector de periodo (esta semana / este mes) en el resumen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Verificación final completa

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Suite completa de tests**

Run: `cd cotizapp && npm test 2>&1 | tail -12`
Expected: `# pass` = total esperado (213 previos + 2 nav + 6 period + 1 page = 222), `# fail 0`.

- [ ] **Step 2: Typecheck + lint**

Run: `cd cotizapp && npx tsc --noEmit && npm run lint`
Expected: exit 0, sin warnings.

- [ ] **Step 3: Build de producción**

Run: `cd cotizapp && npm run build 2>&1 | tail -15`
Expected: build exitoso, exit 0.

- [ ] **Step 4: Revisión visual (manual, lo hace el usuario)**

- PDF: generar una cotización y confirmar que la etiqueta del cliente dice "Cliente".
- Móvil (DevTools responsive ~360px): la barra inferior muestra 7 ítems incluyendo "Inicio", y "Inicio" lleva al dashboard.
- Dashboard: el resumen tiene el toggle "Esta semana / Este mes" y los números cambian al togglear.

---

## Self-review (cobertura del spec)

- Spec §1 (etiqueta PDF) → Task 1. ✓
- Spec §2 (Inicio en nav móvil, 7 ítems) → Task 2. ✓
- Spec §3 (selector de período, ambos calculados en server, toggle cliente, "Aceptado" = aceptadas reales, semana lunes→domingo, regla de moneda para neto) → Tasks 3 y 4. ✓
- Sin placeholders; tipos consistentes (`DashboardPeriodSummary`, `DashboardPeriod`, `bottomNavItems`, `getDashboardPeriodSummary` usados igual en todas las tareas). ✓
