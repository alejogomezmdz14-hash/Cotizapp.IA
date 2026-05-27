"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BusinessIdentity } from "@/components/layout/business-identity";
import {
  getActiveNavHref,
  sidebarNavItems,
} from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

type SidebarProps = {
  businessName: string | null;
  logoUrl: string | null;
};

const baseNavItemClassName =
  "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition";

export function Sidebar({ businessName, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname, sidebarNavItems);

  return (
    <aside className="hidden w-[18.5rem] shrink-0 border-r border-token bg-background/80 lg:block">
      <div className="shell-backdrop sticky top-0 flex h-screen flex-col gap-6 px-4 py-6">
        <div className="shell-panel px-4 py-5">
          <BusinessIdentity
            businessName={businessName}
            logoUrl={logoUrl}
            subtitle="Tu centro de cotizaciones"
            className="items-start"
            avatarClassName="h-12 w-12 shadow-sm"
            nameElement="h2"
            subtitleClassName="text-xs font-medium uppercase tracking-[0.18em]"
            nameClassName="text-base"
          />
        </div>

        <div className="shell-panel flex flex-1 flex-col p-3">
          <p className="px-3 pb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Navegación
          </p>
          <nav className="space-y-2">
            {sidebarNavItems.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    baseNavItemClassName,
                    active
                      ? "border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.12)] text-foreground shadow-[0_18px_40px_-26px_rgba(0,229,160,0.6)]"
                      : "border-transparent text-muted-foreground hover:border-token hover:bg-background/80 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-2xl border transition",
                      active
                        ? "border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.15)] text-accent-token"
                        : "border-token bg-background/70 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {active ? "Sección actual" : "Acceso directo"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-token bg-background/70 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Shell
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Navegación clara para volver rápido a las tareas clave del día.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
