"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryNavItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-token bg-surface/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
      <ul className="grid grid-cols-5 items-end gap-2">
        {primaryNavItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          const isPrimary = item.href === "/cotizaciones/nueva";

          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl text-xs transition",
                  isPrimary
                    ? "relative -top-5 h-16 w-16 rounded-full bg-accent-token text-black shadow-lg ring-4 ring-background"
                    : active
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                <Icon className={isPrimary ? "h-6 w-6" : "h-5 w-5"} />
                {!isPrimary ? <span>{item.label}</span> : <span>Nuevo</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
