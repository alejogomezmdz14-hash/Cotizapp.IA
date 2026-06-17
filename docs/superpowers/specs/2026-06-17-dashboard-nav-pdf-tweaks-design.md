# Diseño — Ajustes de dashboard, navegación móvil y etiqueta del PDF

Fecha: 2026-06-17
Estado: aprobado por el usuario (pendiente de plan de implementación)

## Contexto

Tres pedidos chicos e independientes sobre Cotizapp (Next.js 14 + Clerk + Supabase):

1. La etiqueta del cliente en el PDF de cotización dice "Facturar a"; debe decir
   "Cliente" (la regla del proyecto es no implicar facturación en una cotización).
2. En el celular no hay forma obvia de volver al Dashboard: la barra inferior no
   incluye "Inicio". En desktop el sidebar sí lo tiene.
3. El "Resumen del mes" del dashboard debe tener un selector de período
   `Esta semana / Este mes`.

No hay cambios de base de datos. No hay migraciones manuales nuevas.

---

## 1. Etiqueta del PDF: "Facturar a" → "Cliente"

Cambio de texto puro, en dos archivos que deben quedar consistentes:

- `components/cotizacion/quotation-pdf-template.tsx` (~línea 450): el `<Text>` de
  la etiqueta del bloque del cliente en el PDF real.
- `components/profile/pdf-template-settings.tsx` (~línea 95): la misma etiqueta en
  la preview de la pantalla de ajustes.

Sin lógica nueva. Verificación: build + revisión visual del PDF.

---

## 2. Botón "Inicio" en la barra inferior móvil

`components/layout/bottom-nav.tsx` hoy renderiza `primaryNavItems` (6 ítems) y no
incluye el dashboard. Se agrega `dashboardNavItem` (label "Inicio", ícono `Home`,
href `/dashboard`, ya exportado en `components/layout/nav-items.ts`) como **primer
ítem**.

Resultado: `Inicio · Clientes · Cotizaciones · Nuevo(FAB) · Gastos · Chat · Catálogo`
(7 ítems).

Cambios:
- En `bottom-nav.tsx`, construir la lista local como `[dashboardNavItem, ...primaryNavItems]`
  y usarla tanto para `getActiveNavHref` como para el `.map`.
- Cambiar el grid de `grid-cols-6` a `grid-cols-7`.
- Reducir levemente padding/tamaño de label para que entre cómodo en pantallas de
  ~360px. El FAB central "Nuevo" sigue siendo el ítem destacado (la condición
  `isPrimary` por `href === "/cotizaciones/nueva"` no cambia).

Riesgo: en pantallas muy chicas 7 íconos quedan apretados. Si molesta, la
alternativa (no elegida ahora) es sacar Catálogo de la barra. Se valida
visualmente al final.

---

## 3. Selector de período en el resumen del dashboard

La sección "Resumen del mes" (`app/(dashboard)/dashboard/page.tsx`) pasa a
"Resumen del período" con un toggle `Esta semana / Este mes`. Para el período
elegido muestra tres números: **Aceptado** (cotizaciones aceptadas), **Gastado**
y **Ganancia neta**.

### Enfoque (elegido entre 3)

**Elegido: calcular ambos períodos en el server y togglear en el cliente
(sin recarga).**

- Ventajas: toggle instantáneo sin spinner; no agrega rutas API ni migración; el
  costo extra es trivial (sumas acotadas por fecha, igual que `getCollectedThisMonth`).
- Descartado `?period=` por URL: recarga visible en cada toque.
- Descartado endpoint nuevo + fetch en cliente: overkill, más código y estados de
  carga.

### Capa de datos

Nuevo módulo `lib/dashboard-period.ts`:

- `type DashboardPeriod = "week" | "month"`.
- `getPeriodBoundaries(period: DashboardPeriod, now?: Date): { startIso, endIso, startDate, endDate }`
  - `month`: día 1 a fin de mes (misma convención que `lib/dashboard-monthly.ts`).
  - `week`: lunes 00:00 a domingo 23:59:59.999, hora local (es-AR).
  - Función pura y determinística (recibe `now` inyectable) → unit-testeable.
- `getDashboardPeriodSummary(userId, currency, period): Promise<DashboardPeriodSummary>`
  donde `DashboardPeriodSummary = { accepted: number; spent: number; net: number; canCalculateNet: boolean }`.
  - `accepted`: suma de `quotations.total` con `status in ('accepted','approved')`
    y `created_at` dentro del período. (Mismo criterio de fecha que el fallback
    mensual existente en `lib/dashboard.ts`.)
  - `spent`: suma de `expenses.amount` con `date` dentro del período. Se reusa la
    lógica de moneda existente: `net` solo se calcula si hay una sola moneda de
    gasto y coincide con la moneda del perfil (`canCalculateNet`), igual que hoy.
  - `net = accepted - spent` cuando `canCalculateNet`, si no `0`.

### Cambio de comportamiento a tener presente

Hoy la tarjeta "Aceptado" del resumen muestra en realidad lo **cobrado/pagado**
del mes (`stats.collectedThisMonth`, basado en `paid_at`), no lo aceptado. El
nuevo resumen muestra el total de cotizaciones **aceptadas** del período (status
`accepted`). Es lo que pidió el usuario y alinea el número con su etiqueta, pero
el valor puede diferir del que se ve hoy.

### UI

- Nuevo componente cliente `components/dashboard/dashboard-period-summary.tsx`:
  - Props: `{ week: DashboardPeriodSummary; month: DashboardPeriodSummary; currency: string | null }`.
  - Estado local `period` (default `"month"`).
  - Control segmentado `Esta semana / Este mes` (usar primitivas/estilos
    existentes del design system; sin librerías nuevas).
  - Renderiza las 3 tarjetas (Aceptado / Gastado / Ganancia neta) y la barra de
    ratio de gasto, leyendo del período activo. Cuando no se puede calcular el
    neto, mantiene el CTA actual "Registrá gastos para verla →".
- `dashboard/page.tsx` (server component): calcula `getDashboardPeriodSummary`
  para `"week"` y `"month"` (en el `Promise.all` existente) y pasa ambos al
  componente cliente. La sección de resumen inline actual se reemplaza por
  `<DashboardPeriodSummary ... />`.

### Alcance

El selector controla solo la sección de resumen. Las 4 tarjetas superiores
("Cobrado este mes", "Enviadas", "Pendientes", "Gastos del mes") y "Cotizaciones
recientes" quedan igual.

---

## Testing

- `lib/dashboard-period.ts`:
  - Tests unitarios de `getPeriodBoundaries` (semana lunes→domingo, mes 1→fin;
    casos de borde: domingo, primer/último día de mes) con `now` inyectado.
  - Test de la forma del summary mapeando filas fake (sin DB), si se extrae un
    helper puro de cálculo.
- Verificación general: `npx tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build`. Revisión visual de: PDF (etiqueta), bottom nav en móvil
  (7 ítems), toggle de período en dashboard.

## Convenciones

- Texto de UI en español latino neutro; nunca "presupuesto".
- Sin colores hardcodeados; usar CSS variables del design system.
- Componente en su carpeta de `/components`; lógica en `/lib`, no en el page.
- Sin librerías nuevas.
