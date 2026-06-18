# Diseño — Mejoras mobile: navegación, tarjeta de cotización y padding

Fecha: 2026-06-17
Estado: aprobado por el usuario (pendiente de plan)

## Contexto

Auditoría mobile de Cotizapp detectó que Perfil/Empresa/Ajustes solo se alcanzan
desde el dropdown del avatar (poco descubrible), que el CTA verde de las tarjetas
de cotización domina la pantalla, y un desfase de padding con la barra inferior.
Este spec cubre cuatro arreglos de UX mobile. NO incluye el módulo de estados de
cotización / facturación (es la fase siguiente; ver "Fuera de alcance").

Solo afecta la experiencia mobile; el sidebar de desktop queda igual. Sin cambios
de base de datos.

---

## #1 — Navegación mobile: 6 ítems + hoja "Más"

Hoy la barra inferior (`components/layout/bottom-nav.tsx`) muestra 7 ítems
(`bottomNavItems`) y no incluye Ajustes/Perfil/Empresa. Se reorganiza a **5
destinos + un botón "Más"** que abre una hoja inferior (bottom sheet).

**Barra inferior (6 celdas):**
`Inicio · Clientes · Cotizaciones · ＋Nuevo(FAB) · Gastos · Más`

**Hoja "Más"** (se abre al tocar "Más"):
- Catálogo
- Chat IA
- ── separador ──
- Mi empresa  (/perfil-empresa)
- Mi perfil   (/perfil-usuario)
- Ajustes     (/ajustes)
- Cerrar sesión

**Implementación:**
- `components/layout/nav-items.ts`: reemplazar/añadir listas explícitas:
  - `mobileBarNavItems`: `[dashboardNavItem, Clientes, Cotizaciones, Nuevo, Gastos]` (5).
  - `mobileMoreNavItems`: `[Chat IA, Catálogo]` (los primarios que salen de la barra).
  - `dashboardNavItem`, `primaryNavItems`, `sidebarNavItems`, `sidebarFooterNavItems`
    quedan como están (el sidebar de desktop no cambia).
  - `bottomNavItems` (creado en el cambio anterior) deja de usarse en mobile; se
    puede dejar exportado o quitar si nadie más lo usa (verificar en el plan).
- Nuevo componente cliente `components/layout/mobile-more-sheet.tsx`:
  - Botón "Más" (ícono `MoreHorizontal`, mismo estilo de celda que el resto de la
    barra) que abre una **hoja inferior** basada en el primitivo Radix Dialog ya
    presente (`@radix-ui/react-dialog`) — más robusta al toque en mobile que un
    popover. Slide-up desde abajo, respeta `env(safe-area-inset-bottom)`.
  - Contenido: links de `mobileMoreNavItems` + separador + Mi empresa, Mi perfil,
    Ajustes (Links) + `SignOutButton`. Cierra la hoja al navegar.
  - Marca activo el ítem si la ruta actual coincide (resaltar "Más" si la ruta
    activa está dentro de la hoja).
- `bottom-nav.tsx`: renderizar `grid-cols-6` con las 5 celdas de
  `mobileBarNavItems` + la celda "Más" (`<MobileMoreSheet />`). El FAB "Nuevo"
  sigue siendo el destacado. Subir el label a `text-[11px]` de nuevo (con 6 celdas
  entra cómodo; era `text-[10px]` por las 7).

El menú del avatar (`user-avatar-menu.tsx`) se mantiene (sigue siendo útil en
desktop y como acceso rápido); "Más" es la ruta confiable y descubrible en mobile.

---

## #2 — Tarjeta de cotización mobile más prolija

En `components/cotizacion/quotations-list.tsx` (rama de tarjetas, no la tabla
desktop) el CTA verde es una barra full-width `min-h-12` que domina la tarjeta.
`variant="listPrimary"` de `QuotationShareActions` se usa **solo acá**, así que es
seguro ajustarlo.

**Cambios de layout de la tarjeta:**
- Fila superior: badge de estado (izquierda) + **monto** alineado a la derecha.
- Nombre del cliente: bajar de `text-2xl` a `text-lg`/`text-xl`.
- Número + "Vence …" condensados en una sola línea muted. La fecha de creación
  se omite en la tarjeta mobile para compactar (sigue visible en el detalle).
- Fila de acciones: `mt-3 flex items-center justify-end gap-2` (alineada a la
  derecha), con el botón primario **compacto** + el menú `⋯`.

**Cambios en `QuotationShareActions` variante `listPrimary`:**
- El botón de acción por defecto deja de ser `w-full min-h-12`: pasa a tamaño de
  contenido (sin `w-full`), altura normal, con **ícono + label corto**
  (ej. ícono WhatsApp + "WhatsApp", o ícono + "Ver PDF" según estado). Sigue verde
  (`bg-accent-token text-black`).
- Los estados transitorios (mensaje de error/estado, input de teléfono
  `needsPhoneInput`, botón "Compartir PDF" preparado) mantienen su tratamiento
  full-width y se muestran debajo de la tarjeta cuando aplican — no se comprimen.
- El contenedor deja de forzar `flex-1` para no estirar el botón.

**El menú `⋯` (`QuotationMoreMenu`) se mantiene prominente** en la fila de
acciones: es donde hoy viven "Marcar pagada", "Convertir a factura", "Reabrir",
"Ver detalle", "Eliminar" y donde crecerá el manejo de estados/factura (ver
"Fuera de alcance").

La tarjeta entera sigue siendo un `<Link>` al detalle.

---

## #3 — Padding de la barra inferior (fix chico)

La barra mide 72px (`BOTTOM_NAV_HEIGHT_PX = 72`, `<ul h-[4.5rem]>`) pero el layout
reserva 64px (`app/(dashboard)/layout.tsx`: `pb-[calc(4rem+env(safe-area-inset-bottom))]`).
- Cambiar el padding del `main` a `pb-[calc(4.5rem+env(safe-area-inset-bottom))]`.
- Alinear `MOBILE_BOTTOM_NAV_OFFSET` (en `bottom-nav.tsx`) a `4.5rem` y verificar
  sus usos para mantener consistencia.

---

## #4 — Dropdown del avatar en iOS (de-riesgo + chequeo)

Con "Más" (#1) ofreciendo una ruta robusta (Dialog) a Ajustes/Perfil/Empresa, el
acceso a configuración ya no depende del dropdown del avatar. Adicionalmente:
- Revisar `components/ui/dropdown-menu.tsx` y `user-avatar-menu.tsx` por algún
  problema evidente de apertura al toque en mobile; si hay un bug claro, corregirlo.
- Si no hay bug evidente, no se cambia nada: la confirmación final requiere prueba
  en un iPhone real (la hace el usuario).

---

## Fuera de alcance (fase siguiente — el módulo importante)

Manejo de **estados de cotización** (marcar como aceptada / rechazada / enviada) y
**facturación** (convertir a factura, módulo `/facturas`). Este spec solo preserva
el menú `⋯` como punto de entrada para esas acciones; el diseño del módulo se hace
aparte, antes de producción.

---

## Testing

- `components/layout/nav-items.ts`: tests unitarios de `mobileBarNavItems`
  (Inicio primero, 5 ítems, hrefs esperados) y `mobileMoreNavItems` (Chat,
  Catálogo). Actualizar `tests/nav-items.test.ts` (hoy asume `bottomNavItems` con
  7 ítems).
- Componentes UI (hoja "Más", tarjeta): test de cableado por regex sobre el source
  (patrón ya usado en el repo) + verificación por build y revisión visual.
- General: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- Revisión visual en mobile (la hace el usuario): barra con 6 ítems + "Más" abre la
  hoja con Ajustes/Perfil/Empresa; tarjeta de cotización compacta con botón chico +
  `⋯`; nada tapado por la barra.

## Convenciones

- Texto UI en español latino neutro; nunca "presupuesto".
- Sin colores hardcodeados fuera del design system; sin librerías nuevas (reusar
  Radix Dialog/DropdownMenu existentes).
- Componentes en `/components`; lógica en `/lib`; nada de lógica en page.tsx.
- Mobile-first; respetar `env(safe-area-inset-bottom)`.
