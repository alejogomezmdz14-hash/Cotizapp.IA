"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CotizappLogo } from "@/components/brand/cotizapp-logo";
import { SignOutButton } from "@/components/layout/sign-out-button";
import {
  getActiveNavHref,
  sidebarFooterNavItems,
  sidebarNavItems,
  type NavItem,
} from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const baseNavItemClassName =
  "flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition";

function SidebarNavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        baseNavItemClassName,
        active
          ? "border-sidebar-active/35 bg-sidebar-active/12 text-sidebar shadow-[0_18px_40px_-26px_rgba(0,229,160,0.45)]"
          : "border-transparent text-sidebar/75 hover:border-white/10 hover:bg-white/8 hover:text-sidebar",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-2xl border transition",
          active
            ? "border-sidebar-active/40 bg-sidebar-active/15 text-sidebar-active"
            : "border-white/10 bg-white/5 text-sidebar/70",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.label}</span>
        <span
          className={cn(
            "block truncate text-xs",
            active ? "text-sidebar/80" : "text-sidebar/55",
          )}
        >
          {active ? "Sección actual" : "Acceso directo"}
        </span>
      </div>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const allNavItems = [...sidebarNavItems, ...sidebarFooterNavItems];
  const activeHref = getActiveNavHref(pathname, allNavItems);

  return (
    <aside className="hidden w-[18.5rem] shrink-0 border-r border-white/10 bg-sidebar lg:block">
      <div className="sticky top-0 flex h-screen flex-col gap-4 px-4 py-6">
        <Link
          href="/dashboard"
          className="flex shrink-0 justify-center bg-transparent px-4 py-5"
          aria-label="Ir al inicio de Cotizapp"
        >
          <CotizappLogo variant="on-dark" width={160} priority />
        </Link>

        <div className="app-chrome-surface flex min-h-0 flex-1 flex-col p-3">
          <p className="shrink-0 px-3 pb-3 text-xs font-medium uppercase tracking-[0.18em] text-sidebar/55">
            Navegación
          </p>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {sidebarNavItems.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                />
              ))}
            </nav>

            <div className="shrink-0 space-y-2 border-t border-white/10 pt-3">
              {sidebarFooterNavItems.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                />
              ))}
              <SignOutButton className="w-full justify-center border-white/15 bg-white/5 text-sidebar hover:bg-white/10 hover:text-sidebar" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
