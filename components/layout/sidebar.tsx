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
        "group relative flex items-center gap-3 rounded-md border-l-2 py-1.5 pl-3 pr-3 text-[13px] transition",
        active
          ? "border-sidebar-active bg-[rgba(255,255,255,0.06)] text-white"
          : "border-transparent text-[#C9D1D9] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F2F2F4]",
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 text-[#8B8FA8] transition-colors",
          active ? "text-sidebar-active" : "group-hover:text-white",
        )}
      />
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-medium",
            active ? "text-white" : "text-[#C9D1D9] group-hover:text-[#F2F2F4]",
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
    <aside className="hidden w-[220px] shrink-0 border-r border-[rgba(255,255,255,0.07)] bg-sidebar lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <Link
          href="/dashboard"
          className="flex shrink-0 justify-start bg-transparent px-[18px] pb-3 pt-5"
          aria-label="Ir al inicio de Cotizapp"
        >
          <CotizappLogo variant="on-dark" width={126} priority />
        </Link>

        <div className="flex min-h-0 flex-1 flex-col px-[10px] pb-4">
          <p className="shrink-0 px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[#54545C]">
            Navegación
          </p>

          <div className="flex min-h-0 flex-1 flex-col">
            <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
              {sidebarNavItems.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                />
              ))}
            </nav>

            <div className="shrink-0 space-y-0.5 border-t border-[rgba(255,255,255,0.07)] pt-3">
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
