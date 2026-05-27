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
        "group flex items-center gap-3 rounded-lg border-l-2 py-2.5 pl-4 pr-4 text-sm transition",
        active
          ? "border-sidebar-active bg-sidebar-active text-sidebar-active"
          : "border-transparent text-[#C9D1D9] hover:bg-[rgba(255,255,255,0.05)] hover:text-white",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          active
            ? "text-sidebar-active"
            : "text-[#8B8FA8] group-hover:text-white",
        )}
      />
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-medium",
            active ? "text-sidebar-active" : "text-[#C9D1D9] group-hover:text-white",
          )}
        >
          {item.label}
        </span>
        <span className="block truncate text-[11px] text-[#6B7280]">
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
    <aside className="hidden w-[18.5rem] shrink-0 bg-sidebar lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <Link
          href="/dashboard"
          className="flex shrink-0 justify-center bg-transparent px-5 pb-5 pt-6"
          aria-label="Ir al inicio de Cotizapp"
        >
          <CotizappLogo variant="on-dark" width={140} priority />
        </Link>

        <div className="flex min-h-0 flex-1 flex-col px-3 pb-4">
          <p className="shrink-0 px-4 pb-3 text-xs font-medium uppercase tracking-[0.18em] text-[#8B8FA8]">
            Navegación
          </p>

          <div className="flex min-h-0 flex-1 flex-col">
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {sidebarNavItems.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                />
              ))}
            </nav>

            <div className="shrink-0 space-y-1 border-t border-[rgba(255,255,255,0.06)] pt-3">
              {sidebarFooterNavItems.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                />
              ))}
              <SignOutButton className="mt-1 w-full justify-center rounded-lg border border-[rgba(248,81,73,0.3)] bg-[#1A1D27] px-4 py-2.5 text-[#f85149] hover:bg-[#1A1D27] hover:text-[#f85149]" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
