# ARCA Fase C1 — Integridad de la emisión

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que no se pueda emitir una factura de más, ni con la fecha equivocada, ni que una emisión dudosa quede trabada para siempre. Son los defectos que quedan con consecuencia fiscal real.

**Architecture:** Tres columnas nuevas en `quotations` guardan el número reservado, la fecha exacta que se le informó a ARCA y el estado del comprobante. El número se reserva **antes** de llamar; ante un error se distingue "sabemos que no se emitió" (se libera) de "no sabemos" (queda en revisión y se reconcilia consultándole a ARCA por ese número).

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, `@arcasdk/core` 1.3.1, tests con `node:test` vía `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-07-30-arca-camino-1-design.md` (sección 4.7).
**Depende de:** Fases A, B1 y B2, ya implementadas en esta rama.

## Desvío deliberado del spec, con su motivo

El spec pedía una tabla `facturas` propia, para que el ciclo de vida del comprobante no viviera en columnas de `quotations` que el cliente puede reescribir por PostgREST. **Acá se usan columnas en `quotations`.**

El motivo: la auditoría calificó ese riesgo como **bajo**, porque el único que puede tocar esas columnas es el dueño de la cotización, que además ya puede emitir las facturas que quiera desde "Comprobantes en Línea" de ARCA con su propia Clave Fiscal. No hay cruce entre usuarios ni escalada. En cambio, los defectos que cierra esta fase —doble emisión y fecha equivocada— sí tienen consecuencia fiscal inmediata.

Queda como deuda anotada: migrar el ciclo de vida a una tabla propia con RLS de negación total.

## Global Constraints

- Todo el texto de la UI y los mensajes de error, en **español latino neutro**. Nunca errores técnicos crudos.
- **La fecha del comprobante se calcula en horario argentino**, no en UTC. El repo ya tiene `lib/argentina-time.ts` justamente porque Vercel corre en UTC; hoy solo se usa en el PDF.
- **La fecha que se le informa a ARCA se persiste**, y el PDF y el QR leen esa columna. Nunca se recalcula al imprimir.
- **Nunca liberar una reserva ante un error incierto.** Solo se libera cuando sabemos que ARCA no emitió.
- Migraciones SQL: el usuario las aplica a mano en el SQL Editor del Dashboard de `cotizapp-ia`.
- Al commitear, git imprime warnings inofensivos ("LF will be replaced by CRLF", "failed to delete '.git/worktrees/...'"). No son fallos.
- Rama de trabajo: `feat/arca-fase-c1`, creada desde `feat/arca-fase-b2`.

---

## Task 1: Migración de las columnas del comprobante

**Files:**
- Create: `supabase/migrations/20260731_comprobante_estado.sql`

- [ ] **Step 1: Crear la migración**

```sql
-- Integridad del comprobante electrónico.
--
-- cbte_nro: el número que se reserva ANTES de llamar a ARCA. Sin esto, si la
--   respuesta se pierde por un timeout no hay forma de preguntarle a ARCA si el
--   comprobante existe, y el reintento emite una segunda factura real.
-- cbte_fch: la fecha EXACTA que se le informó a ARCA, en horario argentino. El
--   PDF y el QR la leen de acá en vez de recalcularla, para que los tres digan
--   siempre lo mismo.
-- factura_estado: 'reservado' | 'emitido' | 'en_revision' | 'descartado'.
--   'en_revision' es el caso en que no sabemos si ARCA emitió o no.
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

alter table public.quotations
  add column if not exists cbte_nro integer,
  add column if not exists cbte_fch date,
  add column if not exists factura_estado text
    check (factura_estado in ('reservado','emitido','en_revision','descartado'));

-- Correlatividad por punto de venta: dos comprobantes del mismo usuario no
-- pueden compartir número. Parcial, porque solo aplica a los que llegaron a
-- reservar uno.
create unique index if not exists quotations_cbte_nro_por_usuario
  on public.quotations (user_id, cbte_nro)
  where cbte_nro is not null and factura_estado <> 'descartado';

-- Las filas ya facturadas antes de esta migración quedan como emitidas.
update public.quotations
  set factura_estado = 'emitido'
  where cae is not null and factura_estado is null;
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add supabase/migrations/20260731_comprobante_estado.sql && git commit -m "feat(facturacion): columnas de estado y numero reservado del comprobante

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: La fecha del comprobante en horario argentino

Hoy `formatCbteFch` usa `getUTCFullYear/Month/Date`. Vercel corre en UTC y Argentina es UTC-3, así que **después de las 21:00 hora argentina la factura sale fechada al día siguiente**. Peor: el PDF sí usa la fecha argentina, así que el comprobante impreso y el registrado en ARCA dicen días distintos.

**Files:**
- Modify: `lib/arca/billing.ts`
- Test: `tests/arca-billing.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tests/arca-billing.test.ts`:

```ts
import { getArgentinaToday } from "../lib/argentina-time";

test("CbteFch usa el calendario argentino, no UTC", () => {
  // 23:30 del 18 de junio en Argentina = 02:30 del 19 en UTC. La factura tiene
  // que salir con fecha 18, que es el día que corre para el fisco argentino.
  const instante = new Date("2026-06-19T02:30:00Z");
  const req = buildFacturaCRequest(
    { salesPoint: "0001", total: 1000, date: instante },
    0,
  );

  assert.equal(req.CbteFch, "20260618");
  assert.equal(req.CbteFch, getArgentinaToday(instante).replace(/-/g, ""));
});

test("CbteFch de un instante de mediodia no se corre", () => {
  const req = buildFacturaCRequest(
    { salesPoint: "0001", total: 1000, date: new Date("2026-06-18T15:00:00Z") },
    0,
  );
  assert.equal(req.CbteFch, "20260618");
});
```

- [ ] **Step 2: Correr para verlo fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-billing.test.ts`
Expected: FAIL en el primer test — hoy devuelve `20260619`.

- [ ] **Step 3: Arreglar `formatCbteFch`**

En `lib/arca/billing.ts`, importar `getArgentinaToday` de `@/lib/argentina-time` y reemplazar el cuerpo de `formatCbteFch` por:

```ts
function formatCbteFch(date: Date): string {
  // Horario argentino, no UTC: Vercel corre en UTC y después de las 21:00 ART
  // el día ya cambió allá, así que la factura saldría fechada mañana.
  return getArgentinaToday(date).replace(/-/g, "");
}
```

Borrar el cálculo con `getUTC*` que había.

- [ ] **Step 4: Exponer la fecha en el resultado**

Para poder persistirla, agregar `cbteFch: string` (formato `YYYY-MM-DD`) al tipo `FacturaCResult`, y devolverlo tanto en `issueFacturaC` como en `simulateFacturaC`. En `issueFacturaC` sale de la request que se armó: `getArgentinaToday(input.date)`. Ajustar los tests existentes que construyan un `FacturaCResult` a mano.

- [ ] **Step 5: Correr los tests**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-billing.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/billing.ts tests/arca-billing.test.ts && git commit -m "fix(facturacion): la fecha del comprobante se calcula en horario argentino

Despues de las 21:00 ART la factura salia fechada al dia siguiente, y el PDF
decia otra cosa que ARCA.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Clasificar los errores de emisión

Es el arreglo de la doble emisión. Hoy `catch (emissionError) { await releaseClaim(); throw emissionError; }` libera ante **cualquier** error, sin distinguir un rechazo explícito de ARCA de un timeout. Si ARCA aprobó y se cortó la respuesta, la cotización queda libre y el reintento emite **una segunda factura real con otro CAE**.

**Files:**
- Create: `lib/arca/emission-outcome.ts`
- Test: `tests/arca-emission-outcome.test.ts`

**Interfaces:**
- Produces:
  - `type DecisionDeError = "liberar" | "revisar"`
  - `function decidirAnteError(error: unknown, yaSeLlamoAArca: boolean): DecisionDeError`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/arca-emission-outcome.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { ArcaEmissionError } from "../lib/arca/billing";
import { decidirAnteError } from "../lib/arca/emission-outcome";

test("un rechazo explicito de ARCA libera: no hay comprobante", () => {
  assert.equal(
    decidirAnteError(new ArcaEmissionError("CUIT inválido"), true),
    "liberar",
  );
});

test("cualquier error antes de llamar a ARCA libera", () => {
  assert.equal(decidirAnteError(new Error("lo que sea"), false), "liberar");
  assert.equal(decidirAnteError(new Error("ETIMEDOUT"), false), "liberar");
});

test("un timeout DESPUES de llamar deja la cotizacion en revision", () => {
  // No sabemos si ARCA llegó a emitir. Liberar sería habilitar una segunda
  // factura real sobre la misma cotización.
  assert.equal(decidirAnteError(new Error("ETIMEDOUT"), true), "revisar");
  assert.equal(decidirAnteError(new Error("socket hang up"), true), "revisar");
  assert.equal(decidirAnteError(new Error("ECONNRESET"), true), "revisar");
});

test("ante la duda, revisar: nunca liberamos sin saber", () => {
  assert.equal(decidirAnteError(new Error("algo rarisimo"), true), "revisar");
  assert.equal(decidirAnteError(null, true), "revisar");
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-emission-outcome.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// Qué hacer con la reserva cuando la emisión falla.
//
// La distinción que importa: "sabemos que ARCA no emitió" vs "no sabemos".
// Liberar en el segundo caso es lo que producía dos facturas reales con dos CAE
// sobre la misma cotización — un problema fiscal que solo se arregla con una
// nota de crédito.
//
// Por eso la regla es: ante la duda, NO se libera. Queda en revisión y se
// reconcilia preguntándole a ARCA por el número que reservamos.

import { ArcaEmissionError } from "@/lib/arca/billing";

export type DecisionDeError = "liberar" | "revisar";

export function decidirAnteError(
  error: unknown,
  yaSeLlamoAArca: boolean,
): DecisionDeError {
  // Todavía no despachamos nada: no hay comprobante posible.
  if (!yaSeLlamoAArca) {
    return "liberar";
  }

  // ARCA contestó y rechazó. Hay respuesta, y dice que no emitió.
  if (error instanceof ArcaEmissionError) {
    return "liberar";
  }

  // Cualquier otra cosa después de despachar: no sabemos.
  return "revisar";
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-emission-outcome.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/emission-outcome.ts tests/arca-emission-outcome.test.ts && git commit -m "feat(facturacion): distinguir rechazo de ARCA de incertidumbre ante un error

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Reservar el número y aplicar la decisión

**Files:**
- Modify: `app/actions/facturacion.ts`
- Modify: `lib/arca/billing.ts`

- [ ] **Step 1: Exponer el número antes de emitir**

`issueFacturaC` hoy pide el último comprobante y emite en un solo paso. Para poder reservar hace falta partirlo. Agregar a `lib/arca/billing.ts`:

```ts
/** Pide a ARCA el próximo número disponible, sin emitir nada. */
export async function proximoNumeroComprobante(
  credentials: ArcaCredentials,
  salesPoint: string,
): Promise<number> {
  const { Arca } = await import("@arcasdk/core");

  const arca = new Arca({
    cuit: Number(credentials.cuit.replace(/\D/g, "")),
    cert: credentials.certPem,
    key: credentials.keyPem,
    production: credentials.environment === "produccion",
    useHttpsAgent: true,
    ticketStorage: credentials.ticketStorage,
  });

  const last = await arca.electronicBillingService.getLastVoucher(
    Number(salesPoint.replace(/\D/g, "")) || 0,
    CBTE_TIPO_FACTURA_C,
  );

  return (Number(last?.cbteNro ?? 0) || 0) + 1;
}
```

Y agregar a `emitirFacturaC` un parámetro opcional `numeroReservado?: number`: si viene, se usa ese en vez de volver a preguntar. Pasalo hasta `issueFacturaC`, que ya calcula el número con `buildFacturaCRequest(input, last)` — cuando venga reservado, usar `numeroReservado - 1` como `last` para que el `+1` interno dé el número correcto, o mejor, agregar un parámetro explícito a `issueFacturaC` y no depender de esa aritmética. Elegí lo segundo: es menos frágil.

- [ ] **Step 2: Reservar antes de llamar, en la server action**

En `app/actions/facturacion.ts`, dentro de la rama que no es demo y **después** de obtener las credenciales:

```ts
        // Reservamos el número ANTES de llamar. Si la respuesta de ARCA se
        // pierde, este número es lo único que nos permite preguntarle después
        // si el comprobante existe.
        const numeroReservado = await proximoNumeroComprobante(
          arcaCredentials,
          fiscal!.sales_point,
        );

        await supabase
          .from("quotations")
          .update({ cbte_nro: numeroReservado, factura_estado: "reservado" })
          .eq("id", quotationId)
          .eq("user_id", user.id);
```

Donde `arcaCredentials` es el objeto que ya se le pasa a `emitirFacturaC`; extraelo a una variable para no duplicarlo.

- [ ] **Step 3: Aplicar la decisión en el catch**

Reemplazar el `catch (emissionError)` actual por:

```ts
    } catch (emissionError) {
      const decision = decidirAnteError(emissionError, yaSeLlamoAArca);

      if (decision === "liberar") {
        await releaseClaim();
        throw emissionError;
      }

      // No sabemos si ARCA emitió. NO liberamos: liberar habilitaría una segunda
      // factura real sobre la misma cotización.
      await supabase
        .from("quotations")
        .update({ factura_estado: "en_revision" })
        .eq("id", quotationId)
        .eq("user_id", user.id);

      logError("facturacion.incierto", emissionError, { quotationId });

      return {
        ok: false,
        error:
          "No pudimos confirmar la emisión con ARCA. Apretá «Verificar» en la cotización para chequear si la factura salió.",
      };
    }
```

Declará `let yaSeLlamoAArca = false;` antes del `try` y ponelo en `true` inmediatamente antes de la llamada a `emitirFacturaC` (en la rama demo nunca se toca, porque ahí no hay ARCA).

- [ ] **Step 4: Persistir la fecha y el estado al guardar el CAE**

En el update que persiste el CAE, agregar `cbte_fch: result.cbteFch` y `factura_estado: "emitido"`.

- [ ] **Step 5: Verificar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -5`
Expected: los tres limpios.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add app/actions/facturacion.ts lib/arca/billing.ts && git commit -m "fix(facturacion): reservar el numero antes de emitir y no liberar ante incertidumbre

Cierra la doble emision: un timeout despues de que ARCA aprobo dejaba la
cotizacion libre y el reintento emitia una segunda factura real.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Reconciliar contra ARCA

**Files:**
- Modify: `lib/arca/billing.ts`
- Create: `app/actions/verificar-factura.ts`
- Modify: `components/cotizacion/emitir-factura-button.tsx`

- [ ] **Step 1: Consultar un comprobante en ARCA**

Agregar a `lib/arca/billing.ts`:

```ts
export type ComprobanteEnArca =
  | { existe: true; cae: string; caeVencimiento: string; cbteFch: string }
  | { existe: false };

/** Le pregunta a ARCA si un comprobante existe. Solo lectura, no emite nada. */
export async function consultarComprobante(
  credentials: ArcaCredentials,
  salesPoint: string,
  numero: number,
): Promise<ComprobanteEnArca> {
  const { Arca } = await import("@arcasdk/core");

  const arca = new Arca({
    cuit: Number(credentials.cuit.replace(/\D/g, "")),
    cert: credentials.certPem,
    key: credentials.keyPem,
    production: credentials.environment === "produccion",
    useHttpsAgent: true,
    ticketStorage: credentials.ticketStorage,
  });

  const info = await arca.electronicBillingService.getVoucherInfo(
    numero,
    Number(salesPoint.replace(/\D/g, "")) || 0,
    CBTE_TIPO_FACTURA_C,
  );

  const datos = (info as { data?: Record<string, unknown> } | null)?.data ?? info;

  if (!datos || typeof datos !== "object") {
    return { existe: false };
  }

  const record = datos as Record<string, unknown>;
  const cae = record.CodAutorizacion ?? record.CAE;

  if (!cae) {
    return { existe: false };
  }

  return {
    existe: true,
    cae: String(cae),
    caeVencimiento: parseArcaDate(String(record.FchVto ?? record.CAEFchVto ?? "")),
    cbteFch: parseArcaDate(String(record.CbteFch ?? "")),
  };
}
```

- [ ] **Step 2: La server action de verificación**

Crear `app/actions/verificar-factura.ts` con `verificarFacturaAction(quotationId)`, que:
1. Carga la cotización (filtrando por `user_id`) y exige `factura_estado === "en_revision"` y `cbte_nro` no nulo. Si no, devuelve un mensaje explicando que no hay nada que verificar.
2. Carga las credenciales con `loadCredentials`; si no están `ok`, devuelve el mensaje correspondiente (mismo criterio que la emisión).
3. Llama a `consultarComprobante` con el `cbte_nro` guardado.
4. Si **existe**: persiste `cae`, `cae_vencimiento`, `numero_factura` (armado con `formatNumeroFactura`), `cbte_fch` y `factura_estado: "emitido"`. La factura era buena. Devuelve `{ ok: true, emitida: true }`.
5. Si **no existe**: pone `factura_estado: "descartado"`, `facturado_at: null` y `cbte_nro: null` para liberar, y devuelve `{ ok: true, emitida: false }` con un mensaje de que puede reintentar.
6. Si ARCA no responde: deja todo como está y devuelve un error pidiendo reintentar la verificación más tarde.

Usá `logError` para todo error. Mensajes en español latino neutro.

- [ ] **Step 3: El botón de verificar**

En `components/cotizacion/emitir-factura-button.tsx`, agregar una prop `estado?: string | null`. Cuando valga `"en_revision"`, en vez del botón de emitir mostrar un panel que explique que la emisión quedó sin confirmar y un botón "Verificar con ARCA" que llame a `verificarFacturaAction`. Según el resultado, mostrar que la factura sí se había emitido (con el CAE) o que no y puede reintentar.

Pasá la prop desde `app/(dashboard)/cotizaciones/[id]/page.tsx`, leyendo el estado con `getQuotationInvoicing` (agregale el campo si no lo trae).

- [ ] **Step 4: Verificar y commitear**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -5`

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/billing.ts app/actions/verificar-factura.ts components/cotizacion/emitir-factura-button.tsx "app/(dashboard)/cotizaciones/[id]/page.tsx" lib/arca/invoicing-status.ts && git commit -m "feat(facturacion): reconciliar contra ARCA una emision que quedo en duda

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Que una factura demo no pueda pasar por real

**Files:**
- Modify: `lib/arca/billing.ts`
- Modify: `lib/arca/factura-pdf.ts`
- Test: `tests/arca-billing.test.ts`

Hoy `simulateFacturaC` genera un CAE de 14 dígitos empezando en 7 — la forma exacta de un CAE real — y lo guarda en la misma columna. Además el número demo (`DEMO-0001-00000123`) se parte mal en el PDF: `puntoVenta` queda en `"DEMO"` y el QR sale con `ptoVta: 0`.

- [ ] **Step 1: Test que falla**

Agregar a `tests/arca-billing.test.ts`:

```ts
test("un CAE demo no puede confundirse con uno real", () => {
  const r = simulateFacturaC("0001", 7, new Date("2026-06-18T12:00:00Z"));
  assert.match(r.cae, /^DEMO/);
  assert.doesNotMatch(r.cae, /^\d{14}$/);
});
```

- [ ] **Step 2: Cambiar el CAE simulado**

En `simulateFacturaC`, reemplazar el CAE por `` `DEMO-${String(sequence).padStart(8, "0")}` ``. Dejar el prefijo `DEMO-` del `numeroFactura` como está.

- [ ] **Step 3: Arreglar el parseo del número en el PDF**

En `lib/arca/factura-pdf.ts`, el `split("-")` asume dos segmentos. Reemplazarlo por un parseo que tome **los dos últimos** segmentos, que son siempre el punto de venta y el número:

```ts
  // "0001-00000123" o "DEMO-0001-00000123": el punto de venta y el número son
  // siempre los dos últimos segmentos.
  const partes = String(quotation.numero_factura).split("-");
  const numeroComprobante = partes[partes.length - 1] ?? "";
  const puntoVenta = partes[partes.length - 2] ?? "";
```

Y hacer que `toNumber` **no** devuelva 0 en silencio para los campos fiscales: si `puntoVenta`, `numeroComprobante` o el CAE no son numéricos y la factura no es demo, lanzar `FacturaPdfError` con un mensaje amigable. Para las demo, seguir renderizando (el CAE ahora es `DEMO-...`, no numérico a propósito) pero con el cartel de prueba, que ya se deriva del prefijo.

- [ ] **Step 4: Verificar y commitear**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/arca-billing.test.ts && npx tsc --noEmit && npm run lint`

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/arca/billing.ts lib/arca/factura-pdf.ts tests/arca-billing.test.ts && git commit -m "fix(facturacion): CAE demo inconfundible y parseo correcto del numero

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Tiempo máximo de la función

Hoy `vercel.json` no declara `maxDuration`. Una llamada SOAP lenta a ARCA puede morir por el default y dejar el comprobante huérfano — exactamente el caso que la Task 3 manda a revisión, pero que conviene que ocurra lo menos posible.

**Files:**
- Modify: `app/(dashboard)/cotizaciones/[id]/page.tsx`

- [ ] **Step 1: Declarar el máximo**

Las server actions corren bajo la configuración de la ruta que las invoca. Agregar al principio de `app/(dashboard)/cotizaciones/[id]/page.tsx`, junto a los otros exports de configuración si los hay:

```tsx
// La emisión habla con ARCA por SOAP y puede tardar. Sin esto corre con el
// default de la plataforma y un pico de latencia deja el comprobante huérfano.
export const maxDuration = 60;
```

- [ ] **Step 2: Verificar y commitear**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run build 2>&1 | tail -5`

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add "app/(dashboard)/cotizaciones/[id]/page.tsx" && git commit -m "feat(facturacion): maxDuration explicito para la emision contra ARCA

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Verificación final

- [ ] **Step 1: Todo verde**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm test 2>&1 | tail -5 && npx tsc --noEmit && npm run lint && rm -rf .next && npm run build 2>&1 | tail -10; echo "EXIT:${PIPESTATUS[0]}"`
Expected: `EXIT:0`, sin fallos.

- [ ] **Step 2: Confirmar que la fecha ya no se calcula en UTC**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && grep -n "getUTC" lib/arca/billing.ts lib/arca/factura-pdf.ts || echo "  ninguno"`
Expected: ninguno.

- [ ] **Step 3: Anotar los pasos manuales**

Para el reporte: correr `supabase/migrations/20260731_comprobante_estado.sql` en el SQL Editor del Dashboard de `cotizapp-ia`.

---

## Self-review

- Fecha del comprobante en horario argentino, persistida y usada por el PDF y el QR → Tasks 2, 4 y 6. ✓
- Número reservado antes de llamar a ARCA → Tasks 1 y 4. ✓
- No liberar ante incertidumbre; reconciliar consultando el número reservado → Tasks 3, 4 y 5. ✓
- Correlatividad por índice único parcial → Task 1. ✓
- CAE demo imposible de confundir con uno real, y parseo del número arreglado → Task 6. ✓
- `maxDuration` explícito → Task 7. ✓
- Desvío del spec (columnas en `quotations` en vez de tabla `facturas`) justificado y anotado como deuda → cabecera. ✓
- Fuera de alcance: el receptor identificado con CUIT/DNI del cliente y la condición frente al IVA (Fase C2), y la migración del ciclo de vida a una tabla propia.
