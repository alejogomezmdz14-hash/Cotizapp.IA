# Acceso controlado por invitación + cupo de facturas — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que nadie use Cotizapp hasta que el dueño lo autorice, y que la emisión de facturas ARCA tenga cupo gratis igual que las cotizaciones y los escaneos.

**Architecture:** Dos ejes independientes en `publicMetadata` de Clerk. `access` decide si el usuario entra a la app; `plan` decide si es ilimitado (ya existe). Un plan pago implica acceso, para no dejar afuera a alguien que pagó. La decisión vive en un módulo puro y testeable; el middleware solo la aplica. El gate arranca **apagado** detrás de una variable de entorno.

**Tech Stack:** Next.js 14 App Router, Clerk (`clerkMiddleware`), Supabase, tests con `node:test` vía `tsx --test`.

**Contexto de por qué esto vuelve:** el gate duro existió y se sacó a propósito el 2026-06-26 a favor del trial por uso; `/waitlist` quedó marcada como obsoleta en `middleware.ts:14-16`. Vuelve por decisión de producto: se va a lanzar por invitación.

## Global Constraints

- Todo el texto de la UI en **español latino neutro**. Nunca mostrar errores técnicos.
- Mobile-first. Componentes de shadcn/ui cuando existan. Nunca hardcodear colores: siempre CSS variables del design system.
- **El gate arranca apagado.** Se activa con `ACCESS_GATE_ENABLED=1`. Sin esa variable, el comportamiento es idéntico al de hoy.
- **Distinguir "no autorizado" de "Clerk mal configurado".** Si el objeto `metadata` viene entero ausente de los `sessionClaims`, es que falta personalizar el session token en el Dashboard de Clerk (`{ "metadata": "{{user.public_metadata}}" }`, documentado en `lib/auth/plan.ts:6-10`). Ese caso **falla abierto** y loguea fuerte. Si `metadata` está presente pero sin `access`, el usuario genuinamente no está autorizado y va a la lista de espera.
- El enforcement de cupo es **fail-open**, igual que el trial que ya existe (`lib/trial-usage.ts:5-7`): si la columna no existe o la base falla, se deja pasar. El acceso es fail-closed; el cupo es fail-open. Son reglas distintas a propósito.
- Migraciones SQL: se escriben en `supabase/migrations/` y **el usuario las aplica a mano** en el SQL Editor del Dashboard de `cotizapp-ia`.
- Al commitear, git imprime warnings inofensivos ("LF will be replaced by CRLF", "failed to delete '.git/worktrees/...'"). No son fallos; confirmar con `git log --oneline -1`.
- Rama de trabajo: `feat/acceso-controlado`, creada desde `main`.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/auth/access.ts` | Decisión de acceso, pura y testeable. Distingue no-autorizado de mal-configurado. |
| `tests/auth-access.test.ts` | Tests de la decisión. |
| `middleware.ts` | Aplica la decisión y redirige a `/waitlist`. |
| `app/waitlist/page.tsx` | Pantalla de lista de espera (hoy existe pero es inalcanzable). |
| `lib/trial.ts` | Suma `TRIAL_INVOICE_LIMIT` y `canIssueInvoice`. |
| `lib/trial-usage.ts` | Suma el contador `trial_invoices_used`. |
| `supabase/migrations/20260731_trial_invoices_counter.sql` | La columna nueva. |
| `app/actions/facturacion.ts` | Aplica el cupo antes de emitir. |

---

## Task 1: `lib/auth/access.ts` — la decisión de acceso

**Files:**
- Create: `lib/auth/access.ts`
- Test: `tests/auth-access.test.ts`

**Interfaces:**
- Consumes: `isActivePlan` y `planFromSessionClaims` de `lib/auth/plan.ts`.
- Produces:
  - `type AccessReason = "gate-disabled" | "paid-plan" | "granted" | "claims-unavailable" | "not-granted"`
  - `type AccessDecision = { allowed: boolean; reason: AccessReason }`
  - `function readMetadataFromClaims(sessionClaims: unknown): Record<string, unknown> | null`
  - `function decideAccess(sessionClaims: unknown, gateEnabled: boolean): AccessDecision`
  - `const ACCESS_GRANTED_VALUES: Set<string>`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/auth-access.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { decideAccess, readMetadataFromClaims } from "../lib/auth/access";

const CON_ACCESO = { metadata: { access: "granted" } };
const SIN_ACCESO = { metadata: { onboarded: true } };
const PAGO = { metadata: { plan: "pro" } };
const SIN_METADATA = { sub: "user_123" };

test("con el gate apagado entra cualquiera", () => {
  assert.deepEqual(decideAccess(SIN_ACCESO, false), {
    allowed: true,
    reason: "gate-disabled",
  });
  assert.equal(decideAccess(SIN_METADATA, false).allowed, true);
});

test("con el gate prendido, access granted entra", () => {
  assert.deepEqual(decideAccess(CON_ACCESO, true), {
    allowed: true,
    reason: "granted",
  });
});

test("un plan pago implica acceso aunque no tenga access", () => {
  assert.deepEqual(decideAccess(PAGO, true), {
    allowed: true,
    reason: "paid-plan",
  });
});

test("metadata presente pero sin access: no autorizado", () => {
  assert.deepEqual(decideAccess(SIN_ACCESO, true), {
    allowed: false,
    reason: "not-granted",
  });
});

test("metadata ausente por completo: falla ABIERTO (Clerk mal configurado)", () => {
  // Si el session token no expone publicMetadata, el claim no llega. Bloquear
  // ahí dejaría afuera a todo el mundo, incluido el dueño, sin forma de entrar
  // al dashboard a arreglarlo.
  assert.deepEqual(decideAccess(SIN_METADATA, true), {
    allowed: true,
    reason: "claims-unavailable",
  });
  assert.equal(decideAccess(null, true).reason, "claims-unavailable");
  assert.equal(decideAccess({}, true).reason, "claims-unavailable");
});

test("acepta las variantes de nombre que expone Clerk", () => {
  assert.equal(decideAccess({ publicMetadata: { access: "granted" } }, true).allowed, true);
  assert.equal(decideAccess({ public_metadata: { access: "granted" } }, true).allowed, true);
});

test("el valor de access es tolerante a mayusculas y espacios", () => {
  assert.equal(decideAccess({ metadata: { access: "  GRANTED " } }, true).allowed, true);
});

test("un access desconocido no habilita", () => {
  assert.deepEqual(decideAccess({ metadata: { access: "pendiente" } }, true), {
    allowed: false,
    reason: "not-granted",
  });
});

test("readMetadataFromClaims distingue ausente de vacio", () => {
  assert.equal(readMetadataFromClaims({ sub: "x" }), null);
  assert.deepEqual(readMetadataFromClaims({ metadata: {} }), {});
});
```

- [ ] **Step 2: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/auth-access.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `lib/auth/access.ts`**

```ts
/**
 * Acceso por invitación. Dos ejes independientes en `publicMetadata` de Clerk:
 *
 *   access: "granted"       → el usuario puede entrar a la app
 *   plan:   "lifetime"|"pro" → el usuario es ilimitado (ver lib/auth/plan.ts)
 *
 * Un plan pago implica acceso: no queremos dejar afuera por un descuido a
 * alguien que ya pagó.
 *
 * EL CASO DELICADO: para que `publicMetadata` llegue a los sessionClaims hay que
 * personalizar el session token en el Dashboard de Clerk (Sessions → Customize
 * session token) con { "metadata": "{{user.public_metadata}}" }. Si eso falta, el
 * claim viene vacío para TODOS. Bloquear en ese caso dejaría afuera hasta al
 * dueño, sin forma de entrar al dashboard a arreglarlo — así que ese caso
 * concreto FALLA ABIERTO y se loguea. "Metadata ausente" y "usuario sin permiso"
 * parecen lo mismo y son cosas muy distintas.
 */

import { isActivePlan, planFromSessionClaims } from "@/lib/auth/plan";

export const ACCESS_GRANTED_VALUES = new Set(["granted", "beta", "invited"]);

export type AccessReason =
  | "gate-disabled"
  | "paid-plan"
  | "granted"
  | "claims-unavailable"
  | "not-granted";

export type AccessDecision = {
  allowed: boolean;
  reason: AccessReason;
};

/** El objeto de metadata de los claims, o null si no vino ninguno. */
export function readMetadataFromClaims(
  sessionClaims: unknown,
): Record<string, unknown> | null {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return null;
  }

  const claims = sessionClaims as Record<string, unknown>;

  for (const key of ["metadata", "publicMetadata", "public_metadata"]) {
    const value = claims[key];
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

export function decideAccess(
  sessionClaims: unknown,
  gateEnabled: boolean,
): AccessDecision {
  if (!gateEnabled) {
    return { allowed: true, reason: "gate-disabled" };
  }

  if (isActivePlan(planFromSessionClaims(sessionClaims))) {
    return { allowed: true, reason: "paid-plan" };
  }

  const metadata = readMetadataFromClaims(sessionClaims);

  if (metadata === null) {
    // Clerk no está exponiendo publicMetadata. Es configuración rota, no un
    // usuario sin permiso: dejamos pasar y que el log lo grite.
    return { allowed: true, reason: "claims-unavailable" };
  }

  const access = metadata.access;
  const normalized =
    typeof access === "string" ? access.trim().toLowerCase() : "";

  if (ACCESS_GRANTED_VALUES.has(normalized)) {
    return { allowed: true, reason: "granted" };
  }

  return { allowed: false, reason: "not-granted" };
}
```

- [ ] **Step 4: Correr para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/auth-access.test.ts`
Expected: PASS — 9 tests, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add lib/auth/access.ts tests/auth-access.test.ts && git commit -m "feat(acceso): decision de acceso por invitacion, pura y testeable

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Aplicar el gate en el middleware

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: `decideAccess` de `lib/auth/access.ts`.

Sin test unitario: el middleware corre en el edge y no es testeable con `tsx --test`. La decisión que aplica ya está cubierta por la Task 1.

- [ ] **Step 1: Agregar el import**

En `middleware.ts`, junto a los imports existentes:

```ts
import { decideAccess } from '@/lib/auth/access'
```

- [ ] **Step 2: Reemplazar el bloque de `/waitlist`**

Hoy `middleware.ts:44-50` redirige a todo el mundo fuera de `/waitlist`. Reemplazar ese bloque completo por:

```ts
  const gateEnabled = process.env.ACCESS_GATE_ENABLED === '1'
  const { sessionClaims } = await auth()
  const access = decideAccess(sessionClaims, gateEnabled)

  if (access.reason === 'claims-unavailable') {
    // El session token de Clerk no está exponiendo publicMetadata. El gate no
    // puede funcionar así, y bloquear dejaría afuera a todos. Se deja pasar y se
    // avisa fuerte: hay que agregar { "metadata": "{{user.public_metadata}}" } en
    // Clerk Dashboard → Sessions → Customize session token.
    console.error('[acceso] ACCESS_GATE_ENABLED=1 pero los sessionClaims no traen publicMetadata; el gate quedó inactivo')
  }

  // La lista de espera es la única página que ve quien todavía no fue autorizado.
  if (isWaitlistRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
    if (access.allowed) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return
  }
```

Y actualizar el comentario de `isWaitlistRoute` (líneas 14-16), que hoy dice que quedó obsoleta:

```ts
// Lista de espera: la ve quien inició sesión pero todavía no fue autorizado por
// el dueño. Se controla con ACCESS_GATE_ENABLED y publicMetadata.access en Clerk.
const isWaitlistRoute = createRouteMatcher(['/waitlist(.*)'])
```

- [ ] **Step 3: Bloquear el resto de la app**

En el bloque final de `middleware.ts` (el que hoy solo chequea `!userId`), agregar la redirección después de la verificación de sesión:

```ts
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  if (!access.allowed) {
    return NextResponse.redirect(new URL('/waitlist', req.url))
  }
```

Nota: `isPublicApiRoute` sigue saliendo antes que todo esto, así que los PDFs compartidos y el health check no se ven afectados.

- [ ] **Step 4: Verificar que sin la variable no cambia nada**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0 en ambos.

Confirmar leyendo el código que, sin `ACCESS_GATE_ENABLED=1`, `decideAccess` devuelve siempre `allowed: true` y por lo tanto el comportamiento es idéntico al actual salvo que `/waitlist` deja de redirigir al dashboard cuando el usuario no tiene acceso — cosa que con el gate apagado nunca ocurre.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add middleware.ts && git commit -m "feat(acceso): aplicar el gate de invitacion en el middleware, apagado por default

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: La pantalla de lista de espera

**Files:**
- Modify: `app/waitlist/page.tsx`

**Interfaces:**
- Consumes: `UPGRADE_WHATSAPP` de `lib/trial.ts` no sirve acá (su mensaje habla de pasar a Pro). Definir el link propio en la página.

Sin test unitario: es una página estática.

- [ ] **Step 1: Leer lo que hay hoy**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && cat app/waitlist/page.tsx`

La página existe pero es inalcanzable desde junio. Leerla antes de tocarla y conservar lo que sirva: el layout, los componentes de shadcn/ui que ya use y el botón de cerrar sesión si lo tiene.

- [ ] **Step 2: Ajustar el contenido**

El mensaje tiene que decir, en español latino neutro y sin jerga:
- Que la cuenta se creó bien (no es un error del usuario).
- Que Cotizapp está abriendo por invitación y que le vamos a avisar.
- Un botón de WhatsApp para pedir acceso, con mensaje precargado: `"Hola! Quiero acceso a Cotizapp."` al mismo número que ya usa `UPGRADE_WHATSAPP` en `lib/trial.ts:18-20`.
- Un botón de cerrar sesión, para que pueda salir y entrar con otra cuenta.

Nada de "no tenés permiso" ni "acceso denegado": el tono es de lista de espera, no de rechazo.

Mobile-first, con los componentes de shadcn/ui que ya usa el proyecto y colores del design system vía CSS variables. Nunca hardcodear un color.

- [ ] **Step 3: Verificar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add app/waitlist/page.tsx && git commit -m "feat(acceso): pantalla de lista de espera con pedido de acceso por WhatsApp

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Cupo gratis de facturas emitidas

**Files:**
- Create: `supabase/migrations/20260731_trial_invoices_counter.sql`
- Modify: `lib/trial.ts`
- Modify: `lib/trial-usage.ts`
- Modify: `app/actions/facturacion.ts`
- Test: `tests/trial.test.ts` (si ya existe, agregar; si no, crearlo)

**Interfaces:**
- Produces:
  - `const TRIAL_INVOICE_LIMIT = 5`
  - `function canIssueInvoice(invoicesUsed: number, isPaid: boolean): boolean`
  - `const INVOICE_TRIAL_LIMIT_ERROR = "__TRIAL_LIMIT_INVOICES__"`
  - `TrialUsage` suma el campo `invoicesUsed: number`
  - `function incrementTrialInvoices(userId: string): Promise<void>`

- [ ] **Step 1: Crear la migración**

Crear `supabase/migrations/20260731_trial_invoices_counter.sql`:

```sql
-- Cupo gratis de facturas electrónicas emitidas. Mismo patrón que los contadores
-- de cotizaciones y escaneos: monótono, por perfil, sin reseteo mensual.
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

alter table public.profiles
  add column if not exists trial_invoices_used integer not null default 0;
```

- [ ] **Step 2: Escribir los tests que fallan**

Buscar primero si ya existe un test del trial: `ls tests/ | grep -i trial`. Si existe, agregar estos casos ahí; si no, crear `tests/trial.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { canIssueInvoice, TRIAL_INVOICE_LIMIT } from "../lib/trial";

test("el trial permite emitir hasta el cupo", () => {
  assert.equal(canIssueInvoice(0, false), true);
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT - 1, false), true);
});

test("el trial corta al llegar al cupo", () => {
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT, false), false);
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT + 10, false), false);
});

test("un plan pago no tiene cupo", () => {
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT + 100, true), true);
});
```

- [ ] **Step 3: Correr para verlos fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/trial.test.ts`
Expected: FAIL — `canIssueInvoice` no existe.

- [ ] **Step 4: Sumar el helper puro a `lib/trial.ts`**

Agregar, siguiendo el estilo del archivo:

```ts
export const TRIAL_INVOICE_LIMIT = 5;

/** Mensaje reconocible para que la UI muestre el paywall en vez del error genérico. */
export const INVOICE_TRIAL_LIMIT_ERROR = "__TRIAL_LIMIT_INVOICES__";

/** ¿Puede emitir otra factura electrónica? Los pagos siempre pueden. */
export function canIssueInvoice(invoicesUsed: number, isPaid: boolean): boolean {
  if (isPaid) {
    return true;
  }

  return invoicesUsed < TRIAL_INVOICE_LIMIT;
}
```

- [ ] **Step 5: Sumar el contador a `lib/trial-usage.ts`**

1. Agregar `invoicesUsed: number` al tipo `TrialUsage` y `invoicesUsed: 0` a `EMPTY_TRIAL_USAGE`.
2. Agregar `"trial_invoices_used"` a la unión `TrialCounterColumn`.
3. En `getTrialUsage`, sumar la columna al `select` y `invoicesUsed: toCounter(row.trial_invoices_used)` al objeto devuelto.
4. Agregar al final:

```ts
export async function incrementTrialInvoices(userId: string): Promise<void> {
  await incrementTrialCounter(userId, "trial_invoices_used");
}
```

Mantener la regla fail-open del archivo: si la columna no existe todavía, `getTrialUsage` devuelve ceros y deja pasar.

- [ ] **Step 6: Correr los tests para verlos pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/trial.test.ts`
Expected: PASS.

- [ ] **Step 7: Aplicar el cupo en la emisión**

En `app/actions/facturacion.ts`, dentro de `emitirFacturaAction`:

1. Agregar los imports:
```ts
import { canIssueInvoice } from "@/lib/trial";
import {
  getTrialUsage,
  incrementTrialInvoices,
  isCurrentUserPaid,
} from "@/lib/trial-usage";
```

2. Después de los guards de la cotización y **antes** del claim atómico (el bloque que hoy reserva la cotización marcando `facturado_at`), agregar:

```ts
    const [isPaid, usage] = await Promise.all([
      isCurrentUserPaid(),
      getTrialUsage(user.id),
    ]);

    if (!canIssueInvoice(usage.invoicesUsed, isPaid)) {
      return {
        ok: false,
        error:
          "Llegaste al límite de facturas gratis. Escribinos por WhatsApp para seguir facturando sin tope.",
      };
    }
```

Es importante que vaya **antes** del claim: si fuera después, una emisión rechazada por cupo dejaría la cotización reservada.

3. Después del update que persiste el CAE con éxito (el que hoy hace `revalidatePath`), y **antes** del `return { ok: true, ... }`, agregar:

```ts
    await incrementTrialInvoices(user.id);
```

Va después de que la factura quedó guardada: solo se consume cupo por una factura que efectivamente se emitió y persistió.

- [ ] **Step 8: Verificar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -5`
Expected: tsc y lint en 0; la suite completa sin fallos nuevos.

- [ ] **Step 9: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add supabase/migrations/20260731_trial_invoices_counter.sql lib/trial.ts lib/trial-usage.ts app/actions/facturacion.ts tests/trial.test.ts && git commit -m "feat(trial): cupo gratis de facturas electronicas emitidas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verificación final

**Files:** ninguno.

- [ ] **Step 1: Suite completa**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm test 2>&1 | tail -6`
Expected: sin fallos.

- [ ] **Step 2: Typecheck, lint y build**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint && rm -rf .next && npm run build 2>&1 | tail -12; echo "EXIT:${PIPESTATUS[0]}"`
Expected: `EXIT:0`.

- [ ] **Step 3: Pasos manuales para el usuario**

Anotar en el reporte (no ejecutar) lo que le queda al dueño:

1. Correr `supabase/migrations/20260731_trial_invoices_counter.sql` en el SQL Editor del Dashboard de `cotizapp-ia`.
2. En Clerk Dashboard → Sessions → **Customize session token**, confirmar que esté `{ "metadata": "{{user.public_metadata}}" }`. **Sin esto el gate no funciona** (queda inactivo y logueando el error).
3. Darse acceso a sí mismo: Clerk Dashboard → Users → su usuario → Public metadata → `{ "access": "granted" }`.
4. **Recién entonces**, poner `ACCESS_GATE_ENABLED=1` en Vercel (Production) y redeployar.
5. Para autorizar a cada usuario nuevo: Clerk Dashboard → Users → Public metadata → `{ "access": "granted" }`.
6. Para volverlo ilimitado: agregar `"plan": "pro"` al mismo objeto.

El orden importa: si se activa `ACCESS_GATE_ENABLED=1` antes del paso 3, el dueño queda en la lista de espera (aunque el fail-open del paso 2 lo cubre si además falta la configuración del token).

---

## Self-review

- Gate de acceso apagado por default, activable por env → Tasks 1 y 2. ✓
- Distinción entre "no autorizado" y "Clerk mal configurado", con fail-open y log en el segundo → Task 1 (tests) y Task 2 (log). ✓
- Un plan pago implica acceso → Task 1. ✓
- Pantalla de lista de espera con tono de invitación y salida por WhatsApp → Task 3. ✓
- Cupo gratis de facturas con el mismo patrón que el trial existente, fail-open → Task 4. ✓
- El cupo se chequea antes del claim y se incrementa después de persistir → Task 4 Step 7. ✓
- Consistencia de nombres: `decideAccess`/`AccessDecision`/`AccessReason`/`readMetadataFromClaims`/`ACCESS_GRANTED_VALUES`, `canIssueInvoice`/`TRIAL_INVOICE_LIMIT`/`INVOICE_TRIAL_LIMIT_ERROR`, `incrementTrialInvoices`/`invoicesUsed`/`trial_invoices_used`. ✓
- Fuera de alcance, explícito: cobro automático (Mercado Pago, webhooks, suscripciones), panel de administración propio para autorizar usuarios sin entrar a Clerk, e invitaciones por email. Todo eso es su propio proyecto.
