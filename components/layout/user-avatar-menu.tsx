"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Building2, Settings, User } from "lucide-react";

import { SignOutButton } from "@/components/layout/sign-out-button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserAvatarMenuProps = {
  avatarUrl: string | null;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
};

function getUserInitials(firstName: string | null | undefined, lastName: string | null | undefined) {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();

  const initials = `${f ? f[0] : ""}${l ? l[0] : ""}`.toUpperCase();
  return initials || "U";
}

export function UserAvatarMenu({
  avatarUrl,
  firstName,
  lastName,
}: UserAvatarMenuProps) {
  const initials = useMemo(
    () => getUserInitials(firstName, lastName),
    [firstName, lastName],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded-full ring-offset-background transition hover:ring-2 hover:ring-accent-token/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-token",
          )}
          aria-label="Abrir menú de perfil"
          title="Perfil"
        >
          <Avatar className="h-10 w-10 border border-token bg-surface-2">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="Foto de perfil" /> : null}
            <AvatarFallback className="bg-surface-2 text-sm font-semibold text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/perfil-usuario" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Mi perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/perfil-empresa" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Mi empresa
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/ajustes" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Ajustes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <SignOutButton menuItem className="text-foreground" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

