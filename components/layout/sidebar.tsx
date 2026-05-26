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

export function Sidebar({ businessName, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const activeHref = getActiveNavHref(pathname, sidebarNavItems);

  return (
    <aside className="hidden w-72 shrink-0 border-r border-token bg-surface lg:block">
      <div className="sticky top-0 flex h-screen flex-col px-4 py-6">
        <div className="mb-8 px-3">
          <BusinessIdentity
            businessName={businessName}
            logoUrl={logoUrl}
            subtitle="Tu centro de cotizaciones"
            avatarClassName="h-12 w-12"
            nameElement="h2"
          />
        </div>

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
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                  active
                    ? "bg-accent-token text-black shadow-sm"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
