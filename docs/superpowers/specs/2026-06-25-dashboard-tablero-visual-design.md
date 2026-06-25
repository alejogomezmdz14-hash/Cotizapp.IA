# Dashboard "Tablero visual" — Diseño

**Fecha:** 2026-06-25
**Estado:** Aprobado (diseño). Pendiente: plan de implementación.

## Objetivo

Rediseñar el inicio (`/dashboard`) para que sea más **gráfico, visual y entendible**
para cualquiera (target: trabajadores de oficio, baja alfabetización digital). Hoy se
ve "muy cuadrado": saludo + 4 tarjetas KPI + resumen de período + lista de recientes,
todo en rectángulos. Existe `dashboard-monthly-chart.tsx` (recharts) que **no se está
renderizando** — lo incorporamos.

## Decisiones tomadas (brainstorming)

- **Dirección:** Tablero visual ("C") — varios gráficos chicos en vez de un número héroe.
- **Interactividad:** SOLO toggle de período (Semana / Este mes) que controla tarjetas y
  torta. **Sin** tap-para-navegar, **sin** tooltips al tocar, **sin** animaciones de carga.
  (Elección explícita del usuario para que no sea abrumador ni "técnico".)
- **Gráfico mensual:** fijo, "últimos 6 meses" (no depende del toggle).

## Layout (mobile-first, de arriba a abajo)

1. **Encabezado:** "Hola, {nombre} 👋" + segmented control **Semana / Este mes**
   (default: Este mes). El toggle controla las secciones 2 y 3.
2. **Tarjetas de stats (grid 2×2):**
   - **Aceptado** ($ del período) + mini-tendencia (sparkline) + variación % vs período anterior.
   - **Gastos** ($ del período) + sparkline.
   - **Ganancia neta** ($ = aceptado − gastos). Sin sparkline. Si gastos = 0, mostrar CTA
     "Registrá gastos para verla →" (regla actual del negocio, se mantiene).
   - **Para seguir:** cantidad de cotizaciones pendientes, número grande.
3. **Torta de estados** (donut) de las cotizaciones del período: Aceptadas / Enviadas /
   Pendientes / Rechazadas, con leyenda + conteo y total al centro.
4. **Gráfico de barras "Cotizado vs gastos · últimos 6 meses"** — reusar
   `DashboardMonthlyChart` (ya existe), ahora sí renderizado.
5. **Cotizaciones recientes** — lista actual, se mantiene.

## Componentes (límites claros)

| Componente | Tipo | Responsabilidad | Datos que recibe |
|---|---|---|---|
| `DashboardOverview` (nuevo) | client | Dueño del estado de período. Renderiza el toggle, las tarjetas (2×2) y la torta. | Bundles `week` y `month` (stats + counts + series de sparkline) |
| `DashboardStatTiles` (nuevo) | client/presentacional | Render de las 4 tarjetas con sparklines. | Valores + series del período activo |
| `DashboardStatusDonut` (nuevo) | client | Render del donut + leyenda. | Conteos por estado del período activo |
| `DashboardMonthlyChart` (existe) | client | Barras cotizado vs gastos, 6 meses. | `DashboardMonthlyPoint[]` |
| Sparkline | presentacional | SVG `polyline` simple (sin librería extra). Inline o mini-componente. | `number[]` |

- `DashboardMetricCards` y `DashboardPeriodSummary` actuales **se reemplazan** por
  `DashboardOverview` (tarjetas + torta unificadas bajo el toggle). El progress bar
  "gastaste X% de lo aceptado" del period-summary actual se descarta (lo cubre la torta
  y la tarjeta de ganancia).

## Datos

Fuentes existentes:
- `lib/dashboard.ts` → KPIs del mes.
- `lib/dashboard-period.ts` → `getDashboardPeriodSummary(userId, currency, "week"|"month")`
  ya da `{ accepted, spent, net, canCalculateNet }` por período. Se extiende para incluir
  **conteos por estado** (accepted/sent/pending/rejected) del período → alimenta la torta.
- `lib/dashboard-monthly.ts` → `DashboardMonthlyPoint { monthLabel, quoted, expenses }`
  (6 meses). Ya sirve para el gráfico y para el sparkline de **Gastos**.

Dato nuevo a agregar:
- **Serie mensual de "aceptado"** (6 puntos) para el sparkline de la tarjeta Aceptado.
  Extender `DashboardMonthlyPoint` con `accepted` (o una función paralela). Si resultara
  costoso, fallback: omitir el sparkline de Aceptado y dejar solo el número + % (el resto
  del diseño no cambia).
- **Variación %** (período actual vs anterior) para Aceptado y Gastos: calcular en la capa
  de datos (`/lib`), no en el componente.

Regla de negocio que se mantiene: KPIs de plata cuentan solo cotizaciones `accepted`;
no mostrar ganancia neta si gastos = 0 (CTA en su lugar).

## Estados borde

- **Sin datos / cuenta nueva:** cada sección con su empty state (la torta y el gráfico ya
  manejan "sin datos"; las tarjetas muestran $0 / "—" y la lista su empty actual). No
  romper el layout.
- **Período sin actividad** (ej. semana sin cotizaciones): tarjetas en 0, torta con mensaje
  "Sin cotizaciones esta semana", gráfico de 6 meses igual visible.

## Accesibilidad / estilo

- Tokens del design system (sin hardcodear colores nuevos salvo los ya usados por estado:
  verde acento, azul enviada, naranja pendiente/gastos, rojo rechazada).
- Texto ≥ 14px en labels, números grandes legibles; toggle táctil ≥ 44px.
- El donut y las barras deben tener equivalente textual (leyenda con conteos, no solo color).

## Fuera de alcance (YAGNI)

- Tap en gráficos para navegar a listas filtradas.
- Tooltips al tocar barras/porciones.
- Animaciones de carga.
- Rango de fechas custom / período "6 meses" en el toggle (el toggle es Semana/Mes; el
  gráfico de 6 meses es fijo).
- Librerías nuevas de charts (se usa el `recharts` ya presente + SVG para sparklines).

## Testing

- Funciones de datos (`/lib`): conteos por estado, serie mensual de aceptado, variación %
  → tests unitarios con `tsx --test` (entradas/fechas controladas).
- Componentes: presentacionales; verificación por `next build` + revisión visual.
