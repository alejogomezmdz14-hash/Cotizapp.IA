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
      {/* El safe-area lo reserva el <nav> de arriba. Repetirlo acá adentro le
          comía altura a los tabs: con box-sizing border-box, en un iPhone con
          indicador quedaban en 38px, por debajo del mínimo táctil de 44px. */}
      <ul className="grid h-[4.5rem] grid-cols-6 items-stretch">
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
                  "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium transition",
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
                  {isPrimary ? "Cotizar" : item.label}
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

// 4.5rem de barra + los 0.75rem que el botón central sobresale con -mt-3.
// Con solo 4.5rem, el bloque verde tapaba los últimos 12px del contenido.
export const MOBILE_BOTTOM_NAV_OFFSET =
  "calc(5.25rem + env(safe-area-inset-bottom))";
