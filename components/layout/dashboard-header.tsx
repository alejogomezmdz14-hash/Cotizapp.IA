import Link from "next/link";

import { BusinessAvatar } from "@/components/layout/business-avatar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";

type DashboardHeaderProps = {
  businessName: string | null;
  logoUrl: string | null;
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function DashboardHeader({
  businessName,
  logoUrl,
  avatarUrl = null,
  firstName = null,
  lastName = null,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[rgba(255,255,255,0.07)] bg-[rgba(10,10,15,0.85)] px-4 py-3 backdrop-blur-md md:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          aria-label="Ir al inicio"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition active:opacity-80"
        >
          <BusinessAvatar businessName={businessName} logoUrl={logoUrl} />

          <div className="min-w-0 flex-1">
            <p className="ui-shell-kicker truncate text-header/70">
              Panel principal
            </p>
            <h1 className="truncate text-[15px] font-medium tracking-[-0.02em] text-header">
              {businessName?.trim() || "Tu negocio"}
            </h1>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <UserAvatarMenu
            avatarUrl={avatarUrl}
            firstName={firstName}
            lastName={lastName}
          />
        </div>
      </div>
    </header>
  );
}
