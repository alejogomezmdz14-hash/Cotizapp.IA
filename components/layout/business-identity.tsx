"use client";

import Link from "next/link";
import React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const DEFAULT_BUSINESS_NAME = "Tu negocio";
const DEFAULT_INITIALS = "TN";

type BusinessIdentityProps = {
  businessName: string | null;
  logoUrl: string | null;
  subtitle?: string | null;
  className?: string;
  avatarClassName?: string;
  nameClassName?: string;
  subtitleClassName?: string;
  nameElement?: "p" | "h1" | "h2";
  avatarHref?: string | null;
};

export function getBusinessInitials(businessName: string | null) {
  const normalizedName = businessName?.trim();

  if (!normalizedName) {
    return DEFAULT_INITIALS;
  }

  const initials = normalizedName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");

  return initials || DEFAULT_INITIALS;
}

export function BusinessIdentity({
  businessName,
  logoUrl,
  subtitle,
  className,
  avatarClassName,
  nameClassName,
  subtitleClassName,
  nameElement = "p",
  avatarHref = null,
}: BusinessIdentityProps) {
  const displayName = businessName?.trim() || DEFAULT_BUSINESS_NAME;
  const NameTag = nameElement;
  const avatarNode = (
    <Avatar
      className={cn(
        "h-11 w-11 border border-token bg-surface-2",
        avatarClassName,
      )}
    >
      {logoUrl ? <AvatarImage src={logoUrl} alt={`Logo de ${displayName}`} /> : null}
      <AvatarFallback className="bg-surface-2 text-sm font-semibold text-foreground">
        {getBusinessInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {avatarHref ? (
        <Link href={avatarHref} aria-label="Abrir perfil de empresa">
          {avatarNode}
        </Link>
      ) : (
        avatarNode
      )}

      <div className="min-w-0 flex-1">
        {subtitle ? (
          <p
            className={cn(
              "truncate text-sm text-muted-foreground",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        ) : null}
        <NameTag
          className={cn("truncate font-semibold text-foreground", nameClassName)}
          title={displayName}
        >
          {displayName}
        </NameTag>
      </div>
    </div>
  );
}
