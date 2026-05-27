"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
          ? "border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.12)] text-foreground shadow-[0_18px_40px_-26px_rgba(59,130,246,0.6)]"
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
}

export function Sidebar() {
  const pathname = usePathname();
  const allNavItems = [...sidebarNavItems, ...sidebarFooterNavItems];
  const activeHref = getActiveNavHref(pathname, allNavItems);

  return (
    <aside className="hidden w-[18.5rem] shrink-0 border-r border-token bg-background/80 lg:block">
      <div className="shell-backdrop sticky top-0 flex h-screen flex-col gap-4 px-4 py-6">
        <Link
          href="/dashboard"
          className="flex shrink-0 justify-center bg-transparent px-4 py-5"
          aria-label="Ir al inicio de Cotizapp"
        >
          <Image
            src="/cotizapp-logo.png"
            alt="Cotizapp"
            width={160}
            height={48}
            className="h-auto w-[160px] max-w-full bg-transparent object-contain"
            priority
          />
        </Link>

        <div className="shell-panel flex min-h-0 flex-1 flex-col p-3">
          <p className="shrink-0 px-3 pb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
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

            <div className="shrink-0 space-y-2 border-t border-token/80 pt-3">
              {sidebarFooterNavItems.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  active={item.href === activeHref}
                />
              ))}
              <SignOutButton className="w-full justify-center" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
