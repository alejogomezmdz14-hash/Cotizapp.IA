# Emisión de Factura Electrónica ARCA (Factura C) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un botón "Emitir factura" en el detalle de una cotización aceptada que llama a ARCA (ex-AFIP) vía `@arcasdk/core`, obtiene un CAE de Factura C y lo guarda en la cotización.

**Architecture:** Toda la conversación con ARCA vive aislada en `lib/arca/` (helpers puros + una interfaz `ElectronicBilling` que desacopla el SDK para testear). Una server action delgada (`emitirFacturaAction`) orquesta auth, validaciones, descarga de credenciales del bucket `fiscal` y persistencia del CAE en `quotations`. El SDK solo se toca en un adaptador (runtime Node).

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (anon key + JWT de Clerk + RLS), `@arcasdk/core` (depende de `soap`/`node-forge` → Node), tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-06-18-arca-electronic-invoicing-design.md`.

**Precondición (dependencia):** Este plan asume implementada la **capa de captura de datos fiscales** (spec/plan `2026-06-18-fiscal-profile-argentina`), que provee: tabla `fiscal_profiles` (con `cuit`, `sales_point`, `contributor_type`, `cert_path`, `key_path`), bucket privado `fiscal`, `lib/fiscal-profile.ts` (`getFiscalProfile`, tipo `FiscalProfile`), `lib/profile-countries.ts` (`isArgentina`) y `STORAGE_BUCKETS.fiscal`. Esa capa **se está implementando en otra sesión**. Si al ejecutar este plan alguna de esas piezas no existe todavía, frenar y avisar (no recrearlas acá).

**Nota git:** Al commitear, git imprime warnings inofensivos ("LF will be replaced by CRLF", "failed to delete '.git/worktrees/...': Permission denied"). No son fallos — confirmar con `git log --oneline -1`.

**Baseline de tests:** En `main` ya hay ~12 tests que fallan desde antes de este trabajo. La verificación final exige que **los tests nuevos pasen** y que **no aumente** la cantidad de fallos respecto del baseline — no exige "fail 0" global.

**Pasos manuales del usuario (Dashboard de `cotizapp-ia`):** Task 1 produce el SQL que el usuario debe correr (ALTER de `fiscal_profiles` + columnas CAE en `quotations`). Hasta aplicarlo, el botón falla-closed con mensaje amigable; el resto de la app no se afecta.

---

## Mapa de archivos

- Create: `supabase/migrations/20260618_arca_invoicing.sql` — `environment` en `fiscal_profiles` + columnas CAE en `quotations` (se aplica a mano).
- Create: `lib/arca/eligibility.ts` — `isFiscalProfileComplete` (puro) + tipo de entrada.
- Test: `tests/arca-eligibility.test.ts`.
- Create: `lib/arca/billing.ts` — tipos, helpers puros (`buildFacturaCRequest`, `formatNumeroFactura`, `parseArcaDate`), `ArcaEmissionError`, `issueFacturaC` (orquestación testeable), `emitirFacturaC` (adaptador del SDK real).
- Test: `tests/arca-billing.test.ts`.
- Create: `lib/arca/invoicing-status.ts` — `getQuotationInvoicing` (lee los campos CAE con fallback resiliente).
- Create: `app/actions/facturacion.ts` — `emitirFacturaAction`.
- Create: `components/cotizacion/emitir-factura-button.tsx` — botón cliente.
- Modify: `app/(dashboard)/cotizaciones/[id]/page.tsx` — gating + render del botón / panel CAE.
- Test: `tests/emitir-factura-wiring.test.ts` — cableado (source-regex).
- Modify (condicional, Task 9): `components/profile/fiscal-profile-form.tsx` + `app/actions/fiscal.ts` — selector de entorno.

---

## Task 1: Migración SQL

**Files:**
- Create: `supabase/migrations/20260618_arca_invoicing.sql`

- [ ] **Step 1: Crear la migración**

Crear `supabase/migrations/20260618_arca_invoicing.sql`:

```sql
-- Emisión de factura electrónica ARCA. Extiende fiscal_profiles con el entorno
-- (homologación/producción) y agrega los campos de CAE a quotations.
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

alter table public.fiscal_profiles
  add column if not exists environment text not null default 'homologacion'
    check (environment in ('homologacion', 'produccion'));

alter table public.quotations
  add column if not exists cae text,
  add column if not exists cae_vencimiento date,
  add column if not exists numero_factura text,
  add column if not exists facturado_at timestamptz;
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add supabase/migrations/20260618_arca_invoicing.sql && git commit -m "feat(facturacion): migracion ARCA (environment + campos CAE en quotations)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: commit creado (verificar con `git log --oneline -1`).

---

## Task 2: Instalar `@arcasdk/core` y confirmar su API

**Files:**
- Modify: `package.json`, `package-lock.json` (vía npm).

- [ ] **Step 1: Instalar el paquete**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm install @arcasdk/core`
Expected: exit 0; `@arcasdk/core` aparece en `dependencies` de `package.json`.

- [ ] **Step 2: Confirmar la superficie real del SDK (sin esto, Task 5 puede usar nombres equivocados)**

Inspeccionar los tipos instalados para confirmar tres cosas y anotarlas:

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && find node_modules/@arcasdk/core -name "*.d.ts" | head -40`

Abrir los `.d.ts` relevantes (typedefs de la clase `Arca` y de `electronicBillingService`) y confirmar:
1. **Constructor**: opciones de `new Arca({...})` y **cómo se selecciona producción vs homologación** (p. ej. una opción `production?: boolean`). Anotar el nombre real.
2. **Último comprobante**: el método para obtener el último número autorizado dado `PtoVta` + `CbteTipo` (p. ej. `getLastVoucher(ptoVta, cbteTipo)`), y la forma de su respuesta (¿devuelve número o `{ CbteNro }`?).
3. **Crear comprobante**: el método para emitir y obtener el CAE (`createVoucher` o `createNextVoucher` o `createInvoice`), y la forma de la respuesta (dónde vienen `CAE`, `CAEFchVto`, `Resultado`, `CbteDesde`).

Dejar las conclusiones como comentario al inicio de `lib/arca/billing.ts` cuando se cree (Task 4). El **único** lugar que depende de estos nombres es el adaptador `emitirFacturaC` (Task 5, Step 3); el resto del código usa la interfaz `ElectronicBilling`.

Default si el `.d.ts` no es claro (lo documentado en afipts.com): constructor `{ cuit, cert, key, production }`, `electronicBillingService.getLastVoucher(ptoVta, cbteTipo)`, `electronicBillingService.createVoucher(request)` con respuesta que expone `CAE`, `CAEFchVto`, `Resultado`, `CbteDesde`.

- [ ] **Step 3: Typecheck (el paquete trae sus tipos)**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add package.json package-lock.json && git commit -m "chore(facturacion): instalar @arcasdk/core

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `lib/arca/eligibility.ts` — perfil fiscal completo

Decide si la cotización puede facturarse. Puro y testeable, sin depender de la capa de captura (define su propio tipo de entrada estrecho).

**Files:**
- Create: `lib/arca/eligibility.ts`
- Test: `tests/arca-eligibility.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/arca-eligibility.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { isFiscalProfileComplete } from "../lib/arca/eligibility";

const complete = {
  cuit: "20-12345678-9",
  sales_point: "0001",
  contributor_type: "monotributista",
  cert_path: "user_x/cert.crt",
  key_path: "user_x/private.key",
};

test("acepta un perfil monotributista completo", () => {
  assert.equal(isFiscalProfileComplete(complete), true);
});

test("rechaza null", () => {
  assert.equal(isFiscalProfileComplete(null), false);
});

test("rechaza si falta el certificado o la clave", () => {
  assert.equal(isFiscalProfileComplete({ ...complete, cert_path: null }), false);
  assert.equal(isFiscalProfileComplete({ ...complete, key_path: "" }), false);
});

test("rechaza si falta cuit o punto de venta", () => {
  assert.equal(isFiscalProfileComplete({ ...complete, cuit: "" }), false);
  assert.equal(isFiscalProfileComplete({ ...complete, sales_point: null }), false);
});

test("rechaza si no es monotributista (v1 solo Factura C)", () => {
  assert.equal(
    isFiscalProfileComplete({ ...complete, contributor_type: "responsable_inscripto" }),
    false,
  );
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-eligibility.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `lib/arca/eligibility.ts`**

```ts
// Elegibilidad para emitir Factura C. El formato del CUIT ya se valida al
// capturar los datos fiscales, así que acá solo chequeamos presencia + que sea
// monotributista (v1 solo emite Factura C).

export type BillingFiscalProfile = {
  cuit: string | null;
  sales_point: string | null;
  contributor_type: string | null;
  cert_path: string | null;
  key_path: string | null;
};

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isFiscalProfileComplete(
  profile: BillingFiscalProfile | null | undefined,
): boolean {
  if (!profile) {
    return false;
  }

  return (
    isFilled(profile.cuit) &&
    isFilled(profile.sales_point) &&
    isFilled(profile.cert_path) &&
    isFilled(profile.key_path) &&
    profile.contributor_type === "monotributista"
  );
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-eligibility.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/eligibility.ts tests/arca-eligibility.test.ts && git commit -m "feat(facturacion): elegibilidad de perfil fiscal para Factura C

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `lib/arca/billing.ts` — tipos + helpers puros

Solo las funciones puras (sin SDK). El armado del payload de Factura C, el formato del número de factura y el parseo de la fecha del CAE.

**Files:**
- Create: `lib/arca/billing.ts`
- Test: `tests/arca-billing.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/arca-billing.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFacturaCRequest,
  formatNumeroFactura,
  parseArcaDate,
} from "../lib/arca/billing";

test("buildFacturaCRequest arma una Factura C sin IVA", () => {
  const req = buildFacturaCRequest(
    { salesPoint: "0001", total: 1500, date: new Date("2026-06-18T12:00:00Z") },
    122,
  );

  assert.equal(req.CantReg, 1);
  assert.equal(req.PtoVta, 1);
  assert.equal(req.CbteTipo, 11); // Factura C
  assert.equal(req.Concepto, 1); // Productos
  assert.equal(req.DocTipo, 99); // Consumidor Final
  assert.equal(req.DocNro, 0);
  assert.equal(req.CbteDesde, 123); // último + 1
  assert.equal(req.CbteHasta, 123);
  assert.equal(req.CbteFch, "20260618");
  assert.equal(req.ImpTotal, 1500);
  assert.equal(req.ImpNeto, 1500); // C no discrimina: neto = total
  assert.equal(req.ImpIVA, 0);
  assert.equal(req.MonId, "PES");
  assert.equal(req.MonCotiz, 1);
  assert.equal((req as { Iva?: unknown }).Iva, undefined); // sin alícuotas
});

test("buildFacturaCRequest redondea el total a 2 decimales", () => {
  const req = buildFacturaCRequest(
    { salesPoint: "1", total: 1500.005, date: new Date("2026-01-02T00:00:00Z") },
    0,
  );
  assert.equal(req.ImpTotal, 1500.01);
  assert.equal(req.ImpNeto, 1500.01);
  assert.equal(req.CbteFch, "20260102");
});

test("formatNumeroFactura usa PtoVta-Comprobante con padding", () => {
  assert.equal(formatNumeroFactura("0001", 123), "0001-00000123");
  assert.equal(formatNumeroFactura("1", 7), "0001-00000007");
});

test("parseArcaDate convierte YYYYMMDD a ISO date", () => {
  assert.equal(parseArcaDate("20260918"), "2026-09-18");
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-billing.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar la parte pura de `lib/arca/billing.ts`**

```ts
// Emisión de Factura C contra ARCA (ex-AFIP). El SDK @arcasdk/core solo se toca
// en `emitirFacturaC` (adaptador); el resto es puro/testeable vía la interfaz
// ElectronicBilling.
//
// API del SDK confirmada en node_modules/@arcasdk/core (ver Task 2). Defaults:
//   new Arca({ cuit, cert, key, production })
//   arca.electronicBillingService.getLastVoucher(ptoVta, cbteTipo)
//   arca.electronicBillingService.createVoucher(request) -> { CAE, CAEFchVto, Resultado, CbteDesde }

export type ArcaEnvironment = "homologacion" | "produccion";

const CBTE_TIPO_FACTURA_C = 11;
const CONCEPTO_PRODUCTOS = 1;
const DOC_TIPO_CONSUMIDOR_FINAL = 99;

export type FacturaCInput = {
  salesPoint: string;
  total: number;
  date: Date;
};

export type FacturaCRequest = {
  CantReg: number;
  PtoVta: number;
  CbteTipo: number;
  Concepto: number;
  DocTipo: number;
  DocNro: number;
  CbteDesde: number;
  CbteHasta: number;
  CbteFch: string;
  ImpTotal: number;
  ImpTotConc: number;
  ImpNeto: number;
  ImpOpEx: number;
  ImpIVA: number;
  ImpTrib: number;
  MonId: string;
  MonCotiz: number;
};

export type FacturaCResult = {
  cae: string;
  caeVencimiento: string; // ISO date YYYY-MM-DD
  numeroComprobante: number;
  numeroFactura: string; // "0001-00000123"
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatCbteFch(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function buildFacturaCRequest(
  input: FacturaCInput,
  lastVoucherNumber: number,
): FacturaCRequest {
  const total = round2(input.total);
  const nextNumber = lastVoucherNumber + 1;

  return {
    CantReg: 1,
    PtoVta: Number(input.salesPoint.replace(/\D/g, "")) || 0,
    CbteTipo: CBTE_TIPO_FACTURA_C,
    Concepto: CONCEPTO_PRODUCTOS,
    DocTipo: DOC_TIPO_CONSUMIDOR_FINAL,
    DocNro: 0,
    CbteDesde: nextNumber,
    CbteHasta: nextNumber,
    CbteFch: formatCbteFch(input.date),
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total, // Factura C: neto = total, sin IVA discriminado
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
  };
}

export function formatNumeroFactura(
  salesPoint: string,
  numeroComprobante: number,
): string {
  const pv = (Number(salesPoint.replace(/\D/g, "")) || 0)
    .toString()
    .padStart(4, "0");
  return `${pv}-${String(numeroComprobante).padStart(8, "0")}`;
}

export function parseArcaDate(yyyymmdd: string): string {
  const value = yyyymmdd.trim();
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-billing.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/billing.ts tests/arca-billing.test.ts && git commit -m "feat(facturacion): armado puro del payload de Factura C

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `lib/arca/billing.ts` — orquestación `issueFacturaC` + adaptador del SDK

`issueFacturaC` recibe una interfaz `ElectronicBilling` (testeable con un fake). `emitirFacturaC` construye el `Arca` real y lo adapta.

**Files:**
- Modify: `lib/arca/billing.ts`
- Test: `tests/arca-billing.test.ts` (agregar)

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `tests/arca-billing.test.ts`:

```ts
import { ArcaEmissionError, issueFacturaC } from "../lib/arca/billing";

function fakeBilling(overrides: Partial<{
  last: number;
  response: Record<string, unknown>;
  throwOnCreate: boolean;
}> = {}) {
  const calls: { request?: unknown } = {};
  return {
    calls,
    billing: {
      getLastVoucherNumber: async () => overrides.last ?? 122,
      createVoucher: async (request: unknown) => {
        calls.request = request;
        if (overrides.throwOnCreate) {
          throw new Error("network down");
        }
        return (
          overrides.response ?? {
            Resultado: "A",
            CAE: "75123456789012",
            CAEFchVto: "20260928",
            CbteDesde: 123,
          }
        );
      },
    },
  };
}

test("issueFacturaC devuelve el CAE y el número formateado en éxito", async () => {
  const { billing } = fakeBilling();
  const result = await issueFacturaC(billing, {
    salesPoint: "0001",
    total: 1500,
    date: new Date("2026-06-18T12:00:00Z"),
  });

  assert.equal(result.cae, "75123456789012");
  assert.equal(result.caeVencimiento, "2026-09-28");
  assert.equal(result.numeroComprobante, 123);
  assert.equal(result.numeroFactura, "0001-00000123");
});

test("issueFacturaC lanza ArcaEmissionError si ARCA rechaza", async () => {
  const { billing } = fakeBilling({
    response: { Resultado: "R", Observaciones: { Obs: [{ Msg: "CUIT inválido" }] } },
  });

  await assert.rejects(
    () =>
      issueFacturaC(billing, {
        salesPoint: "0001",
        total: 1500,
        date: new Date("2026-06-18T12:00:00Z"),
      }),
    (err: unknown) => err instanceof ArcaEmissionError,
  );
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-billing.test.ts`
Expected: FAIL — `issueFacturaC` / `ArcaEmissionError` inexistentes.

- [ ] **Step 3: Implementar la orquestación y el adaptador en `lib/arca/billing.ts`**

Agregar al final de `lib/arca/billing.ts`:

```ts
export type RawVoucherResponse = {
  Resultado?: string;
  CAE?: string;
  CAEFchVto?: string;
  CbteDesde?: number;
  Observaciones?: unknown;
  Errores?: unknown;
};

export interface ElectronicBilling {
  getLastVoucherNumber(ptoVta: number, cbteTipo: number): Promise<number>;
  createVoucher(request: FacturaCRequest): Promise<RawVoucherResponse>;
}

export class ArcaEmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArcaEmissionError";
  }
}

function extractArcaMessages(response: RawVoucherResponse): string {
  const fromObs = JSON.stringify(response.Observaciones ?? "");
  const fromErr = JSON.stringify(response.Errores ?? "");
  const combined = `${fromErr} ${fromObs}`.trim();
  // Quedarse con los textos "Msg" si vienen; si no, devolver algo genérico.
  const msgs = combined.match(/"Msg"\s*:\s*"([^"]+)"/g);
  if (msgs && msgs.length > 0) {
    return msgs.map((m) => m.replace(/.*"Msg"\s*:\s*"([^"]+)"/, "$1")).join(" ");
  }
  return "ARCA rechazó el comprobante.";
}

export async function issueFacturaC(
  billing: ElectronicBilling,
  input: FacturaCInput,
): Promise<FacturaCResult> {
  const last = await billing.getLastVoucherNumber(
    Number(input.salesPoint.replace(/\D/g, "")) || 0,
    CBTE_TIPO_FACTURA_C,
  );

  const request = buildFacturaCRequest(input, last);
  const response = await billing.createVoucher(request);

  if (response.Resultado !== "A" || !response.CAE || !response.CAEFchVto) {
    throw new ArcaEmissionError(extractArcaMessages(response));
  }

  const numeroComprobante = response.CbteDesde ?? request.CbteDesde;

  return {
    cae: response.CAE,
    caeVencimiento: parseArcaDate(response.CAEFchVto),
    numeroComprobante,
    numeroFactura: formatNumeroFactura(input.salesPoint, numeroComprobante),
  };
}

export type ArcaCredentials = {
  cuit: string;
  certPem: string;
  keyPem: string;
  environment: ArcaEnvironment;
};

// Adaptador: ÚNICO punto que toca el SDK real. Si los nombres confirmados en
// Task 2 difieren (createInvoice / createNextVoucher / forma de getLastVoucher),
// ajustarlos SOLO acá.
export async function emitirFacturaC(
  credentials: ArcaCredentials,
  input: FacturaCInput,
): Promise<FacturaCResult> {
  const { Arca } = await import("@arcasdk/core");

  const arca = new Arca({
    cuit: Number(credentials.cuit.replace(/\D/g, "")),
    cert: credentials.certPem,
    key: credentials.keyPem,
    production: credentials.environment === "produccion",
  });

  const service = arca.electronicBillingService;

  const billing: ElectronicBilling = {
    getLastVoucherNumber: async (ptoVta, cbteTipo) => {
      const last = await service.getLastVoucher(ptoVta, cbteTipo);
      const value =
        typeof last === "number"
          ? last
          : Number((last as { CbteNro?: number })?.CbteNro ?? 0);
      return Number.isFinite(value) ? value : 0;
    },
    createVoucher: async (request) =>
      (await service.createVoucher(request)) as RawVoucherResponse,
  };

  return issueFacturaC(billing, input);
}
```

Nota: `new Arca(...)` y `service.*` se tipan según el `.d.ts` real (Task 2). Si TS marca incompatibilidad de tipos en `createVoucher(request)`, mapear `request` al tipo que exponga el SDK (los campos son los mismos; solo cambia el nombre del tipo). No cambiar `issueFacturaC` ni los helpers puros.

- [ ] **Step 4: Correr los tests para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-billing.test.ts`
Expected: PASS (6 tests en total).

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/billing.ts tests/arca-billing.test.ts && git commit -m "feat(facturacion): emision Factura C contra ARCA (interfaz desacoplada + adaptador)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `lib/arca/invoicing-status.ts` — lectura de los campos CAE

Lee `cae`/`cae_vencimiento`/`numero_factura`/`facturado_at` de una cotización con fallback resiliente (si la migración no se aplicó, devuelve nulos sin romper).

**Files:**
- Create: `lib/arca/invoicing-status.ts`

Sin test unitario (es un acceso a Supabase; se cubre con el cableado de Task 8 y el build).

- [ ] **Step 1: Implementar `lib/arca/invoicing-status.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export type QuotationInvoicing = {
  cae: string | null;
  caeVencimiento: string | null;
  numeroFactura: string | null;
  facturadoAt: string | null;
};

const EMPTY: QuotationInvoicing = {
  cae: null,
  caeVencimiento: null,
  numeroFactura: null,
  facturadoAt: null,
};

export async function getQuotationInvoicing(
  userId: string,
  quotationId: string,
): Promise<QuotationInvoicing> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("cae, cae_vencimiento, numero_factura, facturado_at")
    .eq("id", quotationId)
    .eq("user_id", userId)
    .maybeSingle();

  // Si las columnas no existen todavía (migración sin aplicar) o no hay fila,
  // devolvemos vacío: la cotización simplemente no está facturada.
  if (error || !data) {
    return EMPTY;
  }

  const row = data as Record<string, unknown>;
  return {
    cae: (row.cae as string | null) ?? null,
    caeVencimiento: (row.cae_vencimiento as string | null) ?? null,
    numeroFactura: (row.numero_factura as string | null) ?? null,
    facturadoAt: (row.facturado_at as string | null) ?? null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/invoicing-status.ts && git commit -m "feat(facturacion): lectura resiliente de los campos CAE de la cotizacion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Server Action `emitirFacturaAction`

**Files:**
- Create: `app/actions/facturacion.ts`

Sin test unitario nuevo (integra requireUser + Supabase + storage + SDK; se cubre con los puros ya testeados, el cableado de Task 8 y el build).

- [ ] **Step 1: Implementar `app/actions/facturacion.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { emitirFacturaC, ArcaEmissionError } from "@/lib/arca/billing";
import { isFiscalProfileComplete } from "@/lib/arca/eligibility";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { getProfile, requireUser } from "@/lib/profile";
import { isArgentina } from "@/lib/profile-countries";
import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { downloadFile } from "@/lib/storage/server";
import { createClient } from "@/lib/supabase/server";

export type EmitirFacturaResult =
  | { ok: true; cae: string; numeroFactura: string; vencimiento: string }
  | { ok: false; error: string };

export async function emitirFacturaAction(
  quotationId: string,
): Promise<EmitirFacturaResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    // 1) Cotización + guards.
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select("id, status, total, cae, facturado_at")
      .eq("id", quotationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (quotationError || !quotation) {
      return { ok: false, error: "No se pudo cargar la cotización." };
    }
    if (quotation.status?.trim().toLowerCase() !== "accepted") {
      return { ok: false, error: "Solo podés facturar cotizaciones aceptadas." };
    }
    if (quotation.cae || quotation.facturado_at) {
      return { ok: false, error: "Esta cotización ya tiene una factura emitida." };
    }

    // 2) País + perfil fiscal.
    const [profile, fiscal] = await Promise.all([
      getProfile(user.id),
      getFiscalProfile(user.clerkId),
    ]);

    if (!isArgentina(profile?.country ?? null)) {
      return { ok: false, error: "La facturación electrónica solo está disponible en Argentina." };
    }
    if (!isFiscalProfileComplete(fiscal)) {
      return {
        ok: false,
        error: "Completá tus datos fiscales en Mi empresa antes de facturar.",
      };
    }

    const environment =
      (fiscal as { environment?: string }).environment === "produccion"
        ? "produccion"
        : "homologacion";

    // 3) Credenciales.
    let certPem: string;
    let keyPem: string;
    try {
      const [cert, key] = await Promise.all([
        downloadFile(STORAGE_BUCKETS.fiscal, `${user.clerkId}/cert.crt`),
        downloadFile(STORAGE_BUCKETS.fiscal, `${user.clerkId}/private.key`),
      ]);
      certPem = Buffer.from(cert.bytes).toString("utf8");
      keyPem = Buffer.from(key.bytes).toString("utf8");
    } catch {
      return {
        ok: false,
        error: "No pudimos leer tu certificado ARCA. Revisá que esté cargado y sea válido.",
      };
    }

    // 4) Emisión.
    const result = await emitirFacturaC(
      {
        cuit: fiscal!.cuit,
        certPem,
        keyPem,
        environment,
      },
      {
        salesPoint: fiscal!.sales_point,
        total: Number(quotation.total ?? 0),
        date: new Date(),
      },
    );

    // 5) Persistir el CAE.
    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        cae: result.cae,
        cae_vencimiento: result.caeVencimiento,
        numero_factura: result.numeroFactura,
        facturado_at: new Date().toISOString(),
      })
      .eq("id", quotationId)
      .eq("user_id", user.id);

    if (updateError) {
      // ARCA ya aprobó: logueamos el CAE para reconciliación manual.
      console.error("[facturacion] CAE emitido pero no se pudo guardar", {
        quotationId,
        cae: result.cae,
        numeroFactura: result.numeroFactura,
        reason: updateError.message,
      });
      return {
        ok: false,
        error: "La factura se emitió pero no se pudo guardar. Anotá el CAE: " + result.cae,
      };
    }

    revalidatePath(`/cotizaciones/${quotationId}`);

    return {
      ok: true,
      cae: result.cae,
      numeroFactura: result.numeroFactura,
      vencimiento: result.caeVencimiento,
    };
  } catch (error) {
    if (error instanceof ArcaEmissionError) {
      return { ok: false, error: error.message };
    }
    console.error("[facturacion] error inesperado", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "ARCA no está disponible en este momento. Probá más tarde." };
  }
}
```

Nota: `getFiscalProfile`/`FiscalProfile` vienen de la capa de captura (precondición). El tipo `FiscalProfile` puede no incluir `environment`; por eso se lee con un cast defensivo `(fiscal as { environment?: string })`. `fiscal!` es seguro tras `isFiscalProfileComplete`.

- [ ] **Step 2: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add app/actions/facturacion.ts && git commit -m "feat(facturacion): server action emitirFacturaAction

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Botón "Emitir factura" + cableado en el detalle

**Files:**
- Create: `components/cotizacion/emitir-factura-button.tsx`
- Modify: `app/(dashboard)/cotizaciones/[id]/page.tsx`
- Test: `tests/emitir-factura-wiring.test.ts`

- [ ] **Step 1: Escribir el test de cableado (falla primero)**

Crear `tests/emitir-factura-wiring.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("emitir-factura-button llama emitirFacturaAction y muestra el CAE", async () => {
  const source = await readFile(
    new URL("../components/cotizacion/emitir-factura-button.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /emitirFacturaAction/);
  assert.match(source, /Emitir factura/);
  assert.match(source, /CAE/);
});

test("el detalle gatea el botón por estado, país y perfil fiscal", async () => {
  const source = await readFile(
    new URL("../app/(dashboard)/cotizaciones/[id]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /EmitirFacturaButton/);
  assert.match(source, /isArgentina/);
  assert.match(source, /isFiscalProfileComplete/);
});
```

- [ ] **Step 2: Correr para verlo fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/emitir-factura-wiring.test.ts`
Expected: FAIL — el componente y el cableado no existen.

- [ ] **Step 3: Crear `components/cotizacion/emitir-factura-button.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Loader2, ReceiptText } from "lucide-react";

import {
  emitirFacturaAction,
  type EmitirFacturaResult,
} from "@/app/actions/facturacion";
import { Button } from "@/components/ui/button";

type EmitirFacturaButtonProps = {
  quotationId: string;
};

export function EmitirFacturaButton({ quotationId }: EmitirFacturaButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmitirFacturaResult | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const res = await emitirFacturaAction(quotationId);
      setResult(res);
    } catch {
      setResult({
        ok: false,
        error: "No pudimos emitir la factura. Probá de nuevo en un momento.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-md border border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
        <p className="text-sm font-semibold text-foreground">Factura emitida ✓</p>
        <p className="mt-1 text-sm text-muted-foreground">
          CAE: <span className="font-medium text-foreground">{result.cae}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Comprobante: {result.numeroFactura} · Vence: {result.vencimiento}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={loading} className="min-h-11 w-full sm:w-fit">
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ReceiptText className="mr-2 h-4 w-4" />
        )}
        Emitir factura
      </Button>
      {result && !result.ok ? (
        <p className="text-sm text-destructive">{result.error}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Cablear en `app/(dashboard)/cotizaciones/[id]/page.tsx`**

1. Agregar imports (junto a los existentes):
```tsx
import { EmitirFacturaButton } from "@/components/cotizacion/emitir-factura-button";
import { isFiscalProfileComplete } from "@/lib/arca/eligibility";
import { getQuotationInvoicing } from "@/lib/arca/invoicing-status";
import { getFiscalProfile } from "@/lib/fiscal-profile";
import { isArgentina } from "@/lib/profile-countries";
```

2. Dentro de `QuotationDetailPage`, después de resolver `profile` (línea ~64, donde ya se hace `const [profile, signaturePreviewUrl] = await Promise.all([...])`), agregar:
```tsx
const showFiscalAr = isArgentina(profile?.country ?? null);
const [fiscalProfile, invoicing] = await Promise.all([
  showFiscalAr ? getFiscalProfile(user.clerkId).catch(() => null) : Promise.resolve(null),
  getQuotationInvoicing(user.id, quotation.id),
]);
const canIssueInvoice =
  quotation.status === "accepted" &&
  showFiscalAr &&
  isFiscalProfileComplete(fiscalProfile) &&
  !invoicing.cae;
```

3. En la `<aside className="space-y-4">` (donde está `<QuotationPaidToggle .../>`, ~línea 260), agregar **antes** del toggle un bloque de facturación:
```tsx
{invoicing.cae ? (
  <div className="rounded-md border border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
    <p className="text-sm font-semibold text-foreground">Factura emitida ✓</p>
    <p className="mt-1 text-sm text-muted-foreground">CAE: {invoicing.cae}</p>
    {invoicing.numeroFactura ? (
      <p className="text-sm text-muted-foreground">
        Comprobante: {invoicing.numeroFactura}
      </p>
    ) : null}
  </div>
) : canIssueInvoice ? (
  <EmitirFacturaButton quotationId={quotation.id} />
) : null}
```

No cambiar el resto de la página.

- [ ] **Step 5: Correr el test de cableado para verlo pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/emitir-factura-wiring.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add components/cotizacion/emitir-factura-button.tsx "app/(dashboard)/cotizaciones/[id]/page.tsx" tests/emitir-factura-wiring.test.ts && git commit -m "feat(facturacion): boton Emitir factura en el detalle de cotizacion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9 (condicional): Selector de entorno en el form fiscal

Solo si los archivos del form fiscal **ya existen** (los crea la sesión de captura). Si no existen al llegar acá, **saltear esta tarea** y dejar `environment` en su default `homologacion`; anotarlo para hacerlo cuando esa capa esté mergeada.

**Files:**
- Modify: `components/profile/fiscal-profile-form.tsx`
- Modify: `app/actions/fiscal.ts`

- [ ] **Step 1: Verificar que el form existe**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && test -f components/profile/fiscal-profile-form.tsx && test -f app/actions/fiscal.ts && echo PRESENTE || echo AUSENTE`
Si imprime `AUSENTE`: saltear Task 9 entera.

- [ ] **Step 2: Agregar el selector de entorno al form**

En `components/profile/fiscal-profile-form.tsx`, después del campo "Punto de venta" (`name="sales_point"`), agregar:
```tsx
<div className="space-y-2">
  <Label htmlFor="environment">Entorno de facturación</Label>
  <select
    id="environment"
    name="environment"
    defaultValue={(fiscalProfile as { environment?: string } | null)?.environment ?? "homologacion"}
    className={selectClassName}
  >
    <option value="homologacion">Homologación (pruebas)</option>
    <option value="produccion">Producción (facturas reales)</option>
  </select>
</div>
```
(`selectClassName` ya está definido en ese archivo.)

- [ ] **Step 3: Persistir `environment` en `saveFiscalProfileAction`**

En `app/actions/fiscal.ts`, dentro de `saveFiscalProfileAction`:
1. Leer el valor: `const environment = readText(formData, "environment") === "produccion" ? "produccion" : "homologacion";`
2. Agregar `environment,` al objeto del `upsert` en `fiscal_profiles`.

- [ ] **Step 4: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add components/profile/fiscal-profile-form.tsx app/actions/fiscal.ts && git commit -m "feat(facturacion): selector de entorno ARCA en datos fiscales

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Verificación final

**Files:** ninguno.

- [ ] **Step 1: Tests nuevos**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-eligibility.test.ts tests/arca-billing.test.ts tests/emitir-factura-wiring.test.ts`
Expected: PASS — 13 tests (5 eligibility + 6 billing + 2 wiring), `# fail 0`.

- [ ] **Step 2: Suite completa (no debe aumentar el baseline de fallos)**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm test 2>&1 | tail -8`
Expected: los fallos preexistentes (~12 en `main`) no aumentan; ningún test nuevo falla.

- [ ] **Step 3: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0, sin warnings.

- [ ] **Step 4: Build (limpiar .next primero por flakiness de OneDrive)**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && rm -rf .next; npm run build 2>&1 | tail -15; echo "EXIT:${PIPESTATUS[0]}"`
Expected: EXIT:0 y tabla de rutas.

- [ ] **Step 5: Recordatorio de pasos manuales**

Avisar al usuario que, para que la facturación persista, debe correr en el SQL Editor del Dashboard de `cotizapp-ia` el contenido de `supabase/migrations/20260618_arca_invoicing.sql` (ALTER de `fiscal_profiles` + columnas CAE en `quotations`).

---

## Self-review (cobertura del spec)

- `@arcasdk/core` (no `afipts`), runtime Node, confirmación de API → Task 2. ✓
- Migración: `environment` en `fiscal_profiles` + `cae`/`cae_vencimiento`/`numero_factura`/`facturado_at` en `quotations` → Task 1. ✓
- Credenciales del bucket `fiscal` por `clerk_user_id`, descarga con `downloadFile`, sin service role → Task 7. ✓
- Factura C (CbteTipo 11, Concepto 1, Consumidor Final 99/0, neto=total, sin IVA, PES) → Task 4. ✓
- Último comprobante + createVoucher + validación `Resultado A` + `ArcaEmissionError` → Task 5. ✓
- Server action con gating (accepted + Argentina + perfil completo + monotributista) + guard anti-doble-emisión + persistencia → Task 7. ✓
- Botón en el detalle, gating server-side, muestra CAE; panel si ya facturada → Task 8 (+ helper Task 6). ✓
- Entorno configurable default homologación (columna + selector coordinado) → Tasks 1 y 9. ✓
- Mensajes de error en español → Tasks 5 y 7. ✓
- Tests puros + wiring + verificación → Tasks 3,4,5,8,10. ✓
- Fuera de alcance (A/B, servicios, CUIT del cliente, NC, PDF con CAE) respetado. ✓
- Tipos/nombres consistentes entre tareas: `isFiscalProfileComplete`/`BillingFiscalProfile`, `buildFacturaCRequest`/`FacturaCRequest`/`FacturaCInput`/`FacturaCResult`, `formatNumeroFactura`, `parseArcaDate`, `issueFacturaC`/`ElectronicBilling`/`RawVoucherResponse`/`ArcaEmissionError`/`emitirFacturaC`/`ArcaCredentials`, `getQuotationInvoicing`/`QuotationInvoicing`, `emitirFacturaAction`/`EmitirFacturaResult`, `EmitirFacturaButton`. ✓
```
