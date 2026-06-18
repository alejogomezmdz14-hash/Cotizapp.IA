# Mejoras mobile (nav + tarjeta de cotización + padding) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer descubribles Perfil/Empresa/Ajustes en mobile (barra de 6 ítems + hoja "Más"), achicar el CTA verde de las tarjetas de cotización, y alinear el padding inferior con la altura real de la barra.

**Architecture:** La barra inferior pasa de 7 a 5 destinos + un botón "Más" que abre un bottom sheet (Radix Dialog vía `components/ui/sheet.tsx`, `side="bottom"`) con Catálogo, Chat, Mi empresa, Mi perfil, Ajustes y Cerrar sesión. La tarjeta de cotización compacta su CTA (botón verde de ancho de contenido, no full-width) conservando el menú `⋯`. Solo mobile; el sidebar de desktop no cambia.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Radix (Dialog/Sheet ya presentes), tests con `node:test` vía `tsx --test`.

**Entorno:** Se trabaja sobre una rama nueva desde `main`. Sin cambios de base de datos. Spec: `docs/superpowers/specs/2026-06-17-mobile-nav-and-quotation-card-design.md`.

**Nota git:** Al commitear, git puede imprimir warnings inofensivos ("LF will be replaced by CRLF", "failed to delete '.git/worktrees/...': Permission denied"). No son fallos — confirmar con `git log --oneline -1`.

---

## Mapa de archivos

- Modificar: `components/layout/nav-items.ts` — quitar `bottomNavItems` (sin uso tras Task 2), agregar `mobileBarNavItems` y `mobileMoreNavItems`.
- Modificar: `tests/nav-items.test.ts` — testear las dos listas nuevas.
- Crear: `components/layout/mobile-more-sheet.tsx` — botón "Más" + bottom sheet.
- Modificar: `components/layout/bottom-nav.tsx` — usar `mobileBarNavItems` + `MobileMoreSheet` (6 celdas).
- Crear: `tests/mobile-more-sheet.test.ts` — test de cableado (la hoja linkea Ajustes/Perfil/Empresa).
- Modificar: `components/cotizacion/quotation-share-actions.tsx` — botón `listPrimary` compacto.
- Modificar: `components/cotizacion/quotations-list.tsx` — layout compacto de la tarjeta mobile.
- Modificar: `app/(dashboard)/layout.tsx` — padding inferior 4rem → 4.5rem.

---

## Task 1: Listas de navegación mobile en nav-items.ts

**Files:**
- Modify: `components/layout/nav-items.ts`
- Test: `tests/nav-items.test.ts`

- [ ] **Step 1: Reescribir el test (falla primero)**

Reemplazar TODO el contenido de `tests/nav-items.test.ts` por:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  mobileBarNavItems,
  mobileMoreNavItems,
} from "../components/layout/nav-items";

test("mobileBarNavItems arranca con Inicio y trae 5 destinos", () => {
  assert.equal(mobileBarNavItems[0]?.href, "/dashboard");
  assert.equal(mobileBarNavItems[0]?.label, "Inicio");
  assert.deepEqual(
    mobileBarNavItems.map((item) => item.href),
    ["/dashboard", "/clientes", "/cotizaciones", "/cotizaciones/nueva", "/gastos"],
  );
});

test("mobileMoreNavItems contiene los secundarios (Chat y Catálogo)", () => {
  assert.deepEqual(
    mobileMoreNavItems.map((item) => item.href),
    ["/chat", "/catalogo"],
  );
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/nav-items.test.ts`
Expected: FAIL — `mobileBarNavItems` / `mobileMoreNavItems` no existen.

- [ ] **Step 3: Editar nav-items.ts**

En `components/layout/nav-items.ts`, ELIMINAR el bloque existente `export const bottomNavItems = [...]` (fue agregado antes y queda sin uso tras Task 2). En su lugar, agregar (después de `sidebarFooterNavItems`):

```ts
const MOBILE_MORE_HREFS: readonly string[] = ["/chat", "/catalogo"];

export const mobileBarNavItems: readonly NavItem[] = [
  dashboardNavItem,
  ...primaryNavItems.filter((item) => !MOBILE_MORE_HREFS.includes(item.href)),
];

export const mobileMoreNavItems: readonly NavItem[] = primaryNavItems.filter(
  (item) => MOBILE_MORE_HREFS.includes(item.href),
);
```

(`primaryNavItems` ya está en el orden: Clientes, Cotizaciones, Nuevo, Gastos, Chat IA, Catálogo — así que `mobileBarNavItems` queda `[Inicio, Clientes, Cotizaciones, Nuevo, Gastos]` y `mobileMoreNavItems` queda `[Chat IA, Catálogo]`.)

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/nav-items.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0. (Si falla por `bottomNavItems` importado en algún lado, ese import se elimina en Task 2; por ahora `bottom-nav.tsx` sigue importándolo — para no romper el typecheck en este task, dejá `bottomNavItems` exportado TAMBIÉN hasta Task 2. Es decir: en Step 3 NO elimines `bottomNavItems` todavía; solo AGREGÁ las dos listas nuevas. La eliminación de `bottomNavItems` se hace en Task 2 Step 5.)

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add components/layout/nav-items.ts tests/nav-items.test.ts && git commit -m "feat(nav): listas mobileBar y mobileMore para la barra inferior

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Hoja "Más" + barra inferior a 6 celdas

**Files:**
- Create: `components/layout/mobile-more-sheet.tsx`
- Modify: `components/layout/bottom-nav.tsx`
- Modify: `components/layout/nav-items.ts` (quitar `bottomNavItems`)
- Test: `tests/mobile-more-sheet.test.ts`

- [ ] **Step 1: Escribir el test de cableado (falla primero)**

Crear `tests/mobile-more-sheet.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("MobileMoreSheet linkea Ajustes, Mi empresa y Mi perfil", async () => {
  const source = await readFile(
    new URL("../components/layout/mobile-more-sheet.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /href="\/ajustes"/);
  assert.match(source, /href="\/perfil-empresa"/);
  assert.match(source, /href="\/perfil-usuario"/);
  assert.match(source, /SignOutButton/);
});

test("BottomNav usa mobileBarNavItems y la hoja Más", async () => {
  const source = await readFile(
    new URL("../components/layout/bottom-nav.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /mobileBarNavItems/);
  assert.match(source, /MobileMoreSheet/);
  assert.match(source, /grid-cols-6/);
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/mobile-more-sheet.test.ts`
Expected: FAIL — el archivo `mobile-more-sheet.tsx` no existe / bottom-nav no referencia lo nuevo.

- [ ] **Step 3: Crear `components/layout/mobile-more-sheet.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Building2, MoreHorizontal, Settings, User } from "lucide-react";

import { mobileMoreNavItems } from "@/components/layout/nav-items";
import { SignOutButton } from "@/components/layout/sign-out-button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const moreLinkClassName =
  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground transition hover:bg-white/5";

export function MobileMoreSheet({ active }: { active: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Más opciones"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition",
            active
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="leading-tight">Más</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-token pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="mb-3">Más opciones</SheetTitle>
        <nav className="grid gap-1">
          {mobileMoreNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <SheetClose asChild key={item.href}>
                <Link href={item.href} className={moreLinkClassName}>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  {item.label}
                </Link>
              </SheetClose>
            );
          })}

          <div className="my-1 border-t border-token" />

          <SheetClose asChild>
            <Link href="/perfil-empresa" className={moreLinkClassName}>
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Mi empresa
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/perfil-usuario" className={moreLinkClassName}>
              <User className="h-5 w-5 text-muted-foreground" />
              Mi perfil
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/ajustes" className={moreLinkClassName}>
              <Settings className="h-5 w-5 text-muted-foreground" />
              Ajustes
            </Link>
          </SheetClose>

          <div className="my-1 border-t border-token" />

          <SignOutButton menuItem className="px-3 py-3 text-foreground" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Reescribir `components/layout/bottom-nav.tsx`**

Reemplazar el contenido por:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileMoreSheet } from "@/components/layout/mobile-more-sheet";
import {
  getActiveNavHref,
  mobileBarNavItems,
  mobileMoreNavItems,
} from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const BOTTOM_NAV_HEIGHT_PX = 72;

const MORE_SHEET_HREFS = [
  ...mobileMoreNavItems.map((item) => item.href),
  "/perfil-empresa",
  "/perfil-usuario",
  "/ajustes",
];

export function BottomNav() {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname, mobileBarNavItems);
  const moreActive =
    activeHref === null &&
    MORE_SHEET_HREFS.some(
      (href) => pathname === href || pathname.startsWith(`${href}/`),
    );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-token bg-background lg:hidden"
      style={{ height: `calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))` }}
      aria-label="Navegación principal"
    >
      <ul
        className="grid h-[4.5rem] grid-cols-6 items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {mobileBarNavItems.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          const isPrimary = item.href === "/cotizaciones/nueva";

          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition",
                  isPrimary
                    ? "-mt-3 rounded-t-2xl bg-accent-token pt-2 text-black shadow-[0_-4px_16px_rgb(var(--accent-rgb)/0.35)]"
                    : active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  isPrimary && "min-h-[4.5rem]",
                )}
              >
                <Icon className={cn("h-5 w-5", isPrimary && "h-7 w-7")} />
                <span className="max-w-full truncate leading-tight">
                  {isPrimary ? "Nuevo" : item.label}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <MobileMoreSheet active={moreActive} />
        </li>
      </ul>
    </nav>
  );
}

export const MOBILE_BOTTOM_NAV_OFFSET =
  "calc(4.5rem + env(safe-area-inset-bottom))";
```

- [ ] **Step 5: Quitar `bottomNavItems` de nav-items.ts**

Ahora que `bottom-nav.tsx` ya no lo importa, eliminar el `export const bottomNavItems = [...]` de `components/layout/nav-items.ts` (queda sin uso). Verificar que no haya otros imports: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && grep -rn "bottomNavItems" components/ app/ tests/` debe devolver vacío.

- [ ] **Step 6: Correr el test de cableado para verlo pasar**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsx --test tests/mobile-more-sheet.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0, sin warnings.

- [ ] **Step 8: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add components/layout/mobile-more-sheet.tsx components/layout/bottom-nav.tsx components/layout/nav-items.ts tests/mobile-more-sheet.test.ts && git commit -m "feat(nav): barra inferior de 6 items + hoja Mas con Ajustes/Perfil/Empresa

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Tarjeta de cotización mobile más compacta

**Files:**
- Modify: `components/cotizacion/quotation-share-actions.tsx`
- Modify: `components/cotizacion/quotations-list.tsx`

Sin test unitario nuevo (cambio puramente visual sin lógica; el repo verifica este tipo de cambios por build + revisión visual). La verificación es tsc/lint/build + Task 6.

- [ ] **Step 1: Botón `listPrimary` compacto en quotation-share-actions.tsx**

En `components/cotizacion/quotation-share-actions.tsx`, dentro de `if (variant === "listPrimary")`, el botón POR DEFECTO (el del bloque final `else`, con `getListPrimaryLabel()`) hoy tiene `className="min-h-12 w-full bg-accent-token text-black hover:bg-accent-hover"`. Cambiarlo a ancho de contenido y agregar un ícono. Reemplazar ese `<Button>` por:

```tsx
<Button
  type="button"
  className="min-h-11 w-fit gap-2 bg-accent-token px-4 text-black hover:bg-accent-hover"
  disabled={isGeneratingPdf || isSharing || isLoadingRecipient || isSavingPhone}
  onClick={() => {
    void handleListPrimaryClick();
  }}
>
  <Send className="h-4 w-4" />
  {isGeneratingPdf
    ? "Generando PDF..."
    : isSharing || isLoadingRecipient
      ? "Preparando PDF..."
      : getListPrimaryLabel()}
</Button>
```

Agregar el import del ícono arriba del archivo: `import { Send } from "lucide-react";`.

Dejar SIN cambios los demás botones/bloques de la variante `listPrimary` (mensajes de error/estado, el form de `needsPhoneInput`, y el botón `preparedShare` "Compartir PDF") — esos mantienen su `w-full` para los flujos transitorios. El contenedor `<div className="min-w-0 flex-1 space-y-2">` queda igual (así los forms transitorios siguen teniendo ancho completo).

- [ ] **Step 2: Compactar el layout de la tarjeta en quotations-list.tsx**

En `components/cotizacion/quotations-list.tsx`, dentro del `.map` de tarjetas mobile (el `<Link>` que arranca aprox. en la línea 256), reemplazar el bloque de info + la fila de acciones por una versión más compacta. El bloque interno del `<Link>` (todo lo que está entre la apertura del `<Link ...>` y su cierre `</Link>`) queda así:

```tsx
<div className="flex items-start justify-between gap-3">
  <div className="flex flex-wrap items-center gap-2">
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${getQuotationStatusBadgeClassName(quotation.status)}`}
    >
      {formatQuotationStatusLabel(quotation.status)}
    </span>
    {isExpired ? (
      <span className="rounded-full border border-destructive/50 bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
        Vencida
      </span>
    ) : null}
  </div>
  <p className="shrink-0 text-lg font-semibold text-foreground">
    {formatCurrencyAmount(quotation.total, currency)}
  </p>
</div>

<div className="mt-3">
  <p className="text-lg font-semibold text-foreground">
    {formatDisplayName(quotation.client_name) || "Cliente sin asignar"}
  </p>
  <p className="mt-0.5 text-sm text-muted-foreground">
    {quotation.number} · Vence{" "}
    {formatShortDate(sanitizeQuotationValidityDate(quotation.valid_until))}
  </p>
</div>

<div
  className="mt-4 flex items-center gap-2"
  onClick={(event) => event.stopPropagation()}
>
  <QuotationShareActions
    quotationId={quotation.id}
    quotationNumber={quotation.number}
    initialPdfGeneratedAt={quotation.pdf_generated_at}
    initialShareToken={quotation.share_token}
    initialSentAt={quotation.sent_at}
    initialStatus={quotation.status}
    isDraft={isDraft}
    variant="listPrimary"
  />
  <QuotationMoreMenu
    quotationId={quotation.id}
    quotationNumber={quotation.number}
    initialStatus={quotation.status}
    paidAt={quotation.paid_at ?? null}
    pdfGeneratedAt={quotation.pdf_generated_at}
    shareToken={quotation.share_token}
    reopenHref={reopenDraftHref}
    showSecondaryPdfActions
  />
</div>
```

Notas:
- Se elimina la fila "Creada … — Vence …" anterior y el monto de abajo; el monto ahora va arriba a la derecha y la fecha de creación se omite (sigue en el detalle).
- El nombre del cliente baja de `text-2xl` a `text-lg`.
- La fila de acciones conserva `QuotationShareActions` (ahora con botón compacto) + `QuotationMoreMenu`. NO quitar el `⋯` (ahí vivirá el manejo de estados/factura).
- Mantener intactos: el `key`, el `className` del `<Link>`, y las variables `reopenDraftHref`, `isDraft`, `isExpired`, `detailHref` que ya se calculan arriba en el map.

- [ ] **Step 3: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0. (Si lint marca `formatShortDate` o algún import sin usar tras quitar la línea de "Creada", ajustá los imports.)

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add components/cotizacion/quotation-share-actions.tsx components/cotizacion/quotations-list.tsx && git commit -m "feat(cotizaciones): tarjeta mobile mas compacta + CTA verde de ancho de contenido

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Alinear padding inferior con la barra (72px)

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Cambiar el padding del `main`**

En `app/(dashboard)/layout.tsx`, el `<main>` tiene hoy `className="flex-1 px-4 py-5 pb-[calc(4rem+env(safe-area-inset-bottom))] md:px-8 lg:pb-7"`. Cambiar `pb-[calc(4rem+env(safe-area-inset-bottom))]` por `pb-[calc(4.5rem+env(safe-area-inset-bottom))]` (4.5rem = 72px = altura real de la barra). El resto del className queda igual.

- [ ] **Step 2: Typecheck**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && git add "app/(dashboard)/layout.tsx" && git commit -m "fix(layout): padding inferior alineado a la altura real de la barra (72px)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Chequeo del dropdown del avatar (#4)

**Files:**
- Read-only: `components/ui/dropdown-menu.tsx`, `components/layout/user-avatar-menu.tsx`

- [ ] **Step 1: Revisar por un bug evidente de apertura al toque**

Leer ambos archivos y buscar problemas claros que impidan abrir el menú al tocar en mobile (ej.: falta de `onPointerDown`/`onClick` en el trigger, `modal`/portal mal configurado, `pointer-events` bloqueados, z-index tapado por la barra). El trigger usa `<DropdownMenuTrigger asChild><button>` (patrón estándar de Radix, que sí responde a touch).

- [ ] **Step 2: Decidir**

- Si hay un bug claro y acotado, corregirlo (sin rediseñar el componente) y commitear con `fix(nav): ...`.
- Si NO hay bug evidente (caso esperado): no se cambia código. Documentar el resultado en el reporte: "Sin bug evidente en el dropdown; el acceso a Ajustes/Perfil ya no depende de él (hoja 'Más'). Confirmación final requiere prueba en iPhone real." No hay commit en este caso.

---

## Task 6: Verificación final

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Suite completa**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm test 2>&1 | tail -12`
Expected: `# fail 0`. El total sube respecto a 222: Task 1 reemplaza los 2 tests de `bottomNavItems` por 2 de `mobileBar/More`; Task 2 agrega 2 de cableado → total esperado ≈ 224.

- [ ] **Step 2: Typecheck + lint**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npx tsc --noEmit && npm run lint`
Expected: exit 0, sin warnings.

- [ ] **Step 3: Build de producción**

Run: `cd "c:/Users/alejo/OneDrive/Desktop/Cotizapp/cotizapp" && npm run build 2>&1 | tail -15`
Expected: build exitoso, exit 0.

- [ ] **Step 4: Revisión visual (la hace el usuario en el teléfono)**

- Barra inferior con 6 ítems (`Inicio · Clientes · Cotizaciones · ＋ · Gastos · Más`); "Más" abre la hoja con Catálogo, Chat, Mi empresa, Mi perfil, Ajustes, Cerrar sesión.
- Tarjeta de cotización: monto arriba a la derecha, nombre más chico, botón verde compacto + `⋯`, sin barra verde gigante.
- Nada de contenido tapado por la barra inferior.

---

## Self-review (cobertura del spec)

- Spec #1 (nav 6 + hoja Más con Ajustes/Perfil/Empresa) → Tasks 1 y 2. ✓
- Spec #2 (tarjeta compacta, CTA no full-width, ⋯ preservado) → Task 3. ✓
- Spec #3 (padding 64→72) → Task 4. ✓
- Spec #4 (de-riesgo + chequeo dropdown) → Task 5 (de-riesgo logrado por la hoja Más en Task 2). ✓
- Fuera de alcance (estados/factura) → respetado; el `⋯` se preserva. ✓
- Tipos/nombres consistentes: `mobileBarNavItems`, `mobileMoreNavItems`, `MobileMoreSheet`, `listPrimary` usados igual en todas las tareas. ✓
- Nota de orden: Task 1 agrega las listas sin borrar `bottomNavItems` (para no romper typecheck); Task 2 borra `bottomNavItems` al dejar de usarse. ✓
