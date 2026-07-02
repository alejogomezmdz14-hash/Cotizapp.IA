# Trial / Freemium por uso — Diseño

**Fecha:** 2026-06-26
**Estado:** Diseño (pendiente de aprobación del spec).

## Objetivo

Reemplazar el **gate duro por plan** (hoy manda a `/waitlist` a todo el que no
tenga `plan = lifetime/pro`) por un **trial por uso**, para que los ~150 leads
del lanzamiento **entren solos**, prueben la app, y conviertan a Pro. El upgrade
es **manual** por ahora (botón de WhatsApp + activación a mano en Clerk).

## Decisiones tomadas (brainstorming)

- **Upgrade: manual.** Al llegar al límite → pantalla "Pasá a Pro" con botón de
  WhatsApp a **+54 261 767 9830** (`wa.me/542617679830`). El fundador activa el
  plan (`pro`/`lifetime`) a mano en el Clerk Dashboard. **Sin integración de pago.**
- **Cupo: total, de una vez** (no mensual): **15 cotizaciones + 10 escaneos de
  factura** en total. Al agotarse, upgrade.
- **Bloqueo suave:** al llegar al límite se bloquea **solo** la acción pasada de
  cupo (crear cotización / escanear factura). Todo lo demás sigue usable (ver,
  editar, mandar, descargar lo ya creado, clientes, catálogo, gastos, WhatsApp, PDF).
- **Conteo: contadores monótonos en `profiles`** (solo suben, no se pueden gamear
  borrando).

## Modelo de plan

- `plan ∈ {lifetime, pro}` → **Pro (ilimitado)**. Los que ya pagaron **no se tocan**.
- Cualquier otro valor / sin plan → **Trial** (con cupo).
- `lib/auth/plan.ts`: se mantiene la lectura del plan desde `publicMetadata.plan`
  (server-side vía sessionClaims / `currentUser`). Se agrega el concepto `isPaid`
  (= `isActivePlan`, ya existe) para decidir trial vs ilimitado. **No** se usa más
  para bloquear el acceso a la app.

## Cambio en el gate (middleware.ts)

Hoy: logueado **sin** plan → redirect a `/waitlist` (bloqueado).
Nuevo:
- Logueado (con o sin plan) → **entra a la app** (trial o pro). Se **elimina** el
  `if (!hasPlan) redirect('/waitlist')`.
- Sin sesión en ruta protegida → `/sign-in` (igual que hoy).
- Rutas públicas (`/`, `/sign-in`, `/sign-up`): si logueado → `/dashboard`
  (antes mandaba a `/waitlist` a los sin plan; ahora siempre `/dashboard`).
- `/waitlist` queda **obsoleta** (ya nadie es redirigido ahí). No se borra la ruta
  para no romper links viejos; simplemente deja de usarse. (Opcional: que
  `/waitlist` redirija a `/dashboard`.)

## Datos (migración manual en Supabase SQL Editor)

```sql
alter table profiles
  add column if not exists trial_quotations_used integer not null default 0,
  add column if not exists trial_invoice_scans_used integer not null default 0;
```

- Arrancan en 0. **Solo suben.** No cuentan retroactivamente lo ya creado: un
  usuario viejo (que estaba en waitlist) empieza el trial "fresco". Aceptable
  para el lanzamiento.

## Límites (constantes)

`lib/trial.ts` (nuevo):
```ts
export const TRIAL_QUOTATION_LIMIT = 15;
export const TRIAL_INVOICE_SCAN_LIMIT = 10;
```

## Enforcement (server-side)

`lib/trial.ts` — helpers puros + acceso a datos:
- Tipo `TrialUsage = { quotationsUsed: number; invoiceScansUsed: number }`.
- Puro (testeable): `canCreateQuotation(usage, isPaid)`, `canScanInvoice(usage, isPaid)`
  → `boolean`. Si `isPaid` → siempre `true`. Si trial → `used < LIMIT`.
- `getTrialUsage(userId)` → lee `trial_quotations_used` / `trial_invoice_scans_used`
  de `profiles`.
- `incrementTrialQuotations(userId)` / `incrementTrialInvoiceScans(userId)` →
  `update profiles set col = col + 1` (atómico vía RPC o `update`).

Puntos de control:
- **Crear cotización** (`app/actions/quotations.ts` → `createDraftQuotationAction`):
  al inicio, si `!isPaid && !canCreateQuotation(usage)` → lanzar un error de límite
  reconocible (ej. `throw new QuotationTrialLimitError()` o devolver
  `{ ok:false, reason:"trial_limit" }`) que la UI traduce al paywall. Si crea OK →
  `incrementTrialQuotations`. **Solo en CREATE**, no en `updateDraftQuotationAction`.
- **Escanear factura** (`app/api/ai/invoice-scan/route.ts`, el que dispara el scan):
  si `!isPaid && !canScanInvoice(usage)` → responder 402/`{error:"trial_limit"}` que
  la UI traduce al paywall. Si el scan termina OK → `incrementTrialInvoiceScans`.

**Alcance de "escaneo de factura":** cuenta el **invoice scan** (escanear factura →
ítems, tabla `invoice_scans`, flujo de `InvoiceDropzone` en crear cotización). El
**escaneo de recibos de gastos** (`/gastos`, `expense-receipt`) **NO** cuenta.
*(Asunción — confirmar.)*

## UI

- **`UpgradePaywall`** (nuevo, `components/trial/`): modal/pantalla con
  "Llegaste al límite del trial gratis. Pasá a Pro para seguir." + botón
  **WhatsApp** (`https://wa.me/542617679830?text=<mensaje precargado>` tipo
  "Hola! Quiero pasar a Pro en Cotizapp."). Copy en voseo.
- **Banner de trial** (recomendado): en dashboard y/o al crear, muestra
  "Te quedan X cotizaciones y Y escaneos gratis". Se **oculta para Pro**.
- Botones **"Crear cotización"** / **"Escanear factura"**: para trial sin cupo,
  abren el paywall en vez de la acción. (El bloqueo real es server-side; esto es UX.)

## Qué NO rompe

- `lifetime`/`pro` → ilimitado, sin banners, sin paywall. Igual que hoy.
- Solo cambia el comportamiento de los **sin plan**: antes bloqueados (`/waitlist`),
  ahora **trial** con cupo.

## Casos borde

- **Concurrencia:** el increment es un `update ... = col + 1` (atómico). Que alguien
  pase de 15 a 16 por una carrera es mínimo y tolerable para MVP.
- **Cotización creada por el chat IA** (`chat-shell` → crea borrador): usa el mismo
  `createDraftQuotationAction`, así que hereda el límite automáticamente. Verificar.
- **Usuario Pro que se le saca el plan:** vuelve a trial con sus contadores actuales;
  no es un flujo esperado, no se maneja especial.

## Testing

- Puro (`tsx --test`): `canCreateQuotation` / `canScanInvoice` (trial bajo/en/ sobre
  límite; isPaid siempre true).
- Enforcement en actions/route: verificación por `next build` + prueba manual (crear
  16 cotizaciones en una cuenta trial → la 16 muestra paywall; poner plan=pro → sin
  límite).

## Fuera de alcance (YAGNI)

- Pago automático (MercadoPago/Stripe) — se diseñó el flujo manual para enchufarlo
  después sin rehacer.
- Cupos mensuales / reseteo.
- Bloqueo total de la app.
- Analytics de conversión.
