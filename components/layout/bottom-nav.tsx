"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getActiveNavHref,
  primaryNavItems,
} from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname, primaryNavItems);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 lg:hidden">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-token bg-background/90 p-2 shadow-[0_-18px_50px_-30px_rgba(15,17,23,0.45)] backdrop-blur-xl">
        <ul className="grid grid-cols-5 items-end gap-2">
          {primaryNavItems.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            const isPrimary = item.href === "/cotizaciones/nueva";

            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-1 rounded-[1.5rem] border text-xs transition",
                    isPrimary
                      ? "relative -top-5 h-[4.5rem] max-w-[4.5rem] rounded-[1.6rem] border-transparent bg-primary text-primary-foreground shadow-[0_20px_40px_-24px_rgba(0,229,160,0.8)]"
                      : active
                        ? "min-h-[4.25rem] border-[rgb(var(--accent-rgb)/0.28)] bg-[rgb(var(--accent-rgb)/0.12)] text-foreground"
                        : "min-h-[4.25rem] border-transparent text-muted-foreground",
                  )}
                >
                  <Icon
                    className={isPrimary ? "h-5 w-5" : "h-[1.125rem] w-[1.125rem]"}
                  />
                  <span className={cn(!isPrimary && "max-w-full truncate px-1")}>
                    {!isPrimary ? item.label : "Nuevo"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
