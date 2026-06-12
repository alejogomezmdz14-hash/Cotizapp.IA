"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getActiveNavHref,
  primaryNavItems,
} from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const BOTTOM_NAV_HEIGHT_PX = 72;

export function BottomNav() {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname, primaryNavItems);

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
        {primaryNavItems.map((item) => {
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
                  {isPrimary ? "Nuevo" : item.href === "/chat" ? "Chat" : item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const MOBILE_BOTTOM_NAV_OFFSET =
  "calc(4rem + env(safe-area-inset-bottom))";
