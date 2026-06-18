"use client";

import Link from "next/link";
import { Building2, MoreHorizontal, Settings, User } from "lucide-react";

import { mobileMoreNavItems } from "@/components/layout/nav-items";
import { SignOutButton } from "@/components/layout/sign-out-button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const moreLinkClassName =
  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground transition hover:bg-white/5";

export function MobileMoreSheet({ active }: { active: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Más opciones"
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition",
            active
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="leading-tight">Más</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="rounded-t-2xl border-token pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="mb-3">Más opciones</SheetTitle>
        <nav className="grid gap-1">
          {mobileMoreNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <SheetClose asChild key={item.href}>
                <Link href={item.href} className={moreLinkClassName}>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  {item.label}
                </Link>
              </SheetClose>
            );
          })}

          <div className="my-1 border-t border-token" />

          <SheetClose asChild>
            <Link href="/perfil-empresa" className={moreLinkClassName}>
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Mi empresa
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/perfil-usuario" className={moreLinkClassName}>
              <User className="h-5 w-5 text-muted-foreground" />
              Mi perfil
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/ajustes" className={moreLinkClassName}>
              <Settings className="h-5 w-5 text-muted-foreground" />
              Ajustes
            </Link>
          </SheetClose>

          <div className="my-1 border-t border-token" />

          <SignOutButton menuItem className="px-3 py-3 text-foreground" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
