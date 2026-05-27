import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserAvatarMenu } from "@/components/layout/user-avatar-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type DashboardHeaderProps = {
  businessName: string | null;
  logoUrl: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
  userAvatarUrl?: string | null;
  showSignOut?: boolean;
};

function getBusinessInitials(businessName: string | null) {
  const normalized = businessName?.trim();
  const segments = normalized ? normalized.split(/\s+/).filter(Boolean).slice(0, 2) : [];
  const initials = segments.map((s) => s[0]?.toUpperCase() ?? "").join("");
  return initials || "TN";
}

export function DashboardHeader({
  businessName,
  logoUrl,
  userFirstName,
  userLastName,
  userAvatarUrl,
  showSignOut = true,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 md:px-6">
      <div className="shell-panel flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatarMenu
            avatarUrl={userAvatarUrl ?? null}
            firstName={userFirstName}
            lastName={userLastName}
          />

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="h-10 w-10 border border-token bg-surface-2">
              {logoUrl ? <AvatarImage src={logoUrl} alt="Logo del negocio" /> : null}
              <AvatarFallback className="bg-surface-2 text-sm font-semibold text-foreground">
                {getBusinessInitials(businessName)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Panel principal
              </p>
              <h1 className="truncate text-lg font-semibold text-foreground">
                {businessName?.trim() || "Tu negocio"}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-[1.4rem] border border-token bg-background/70 p-1.5 shadow-sm">
          <ThemeToggle />
          {showSignOut ? <SignOutButton /> : null}
        </div>
      </div>
    </header>
  );
}
