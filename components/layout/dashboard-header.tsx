import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CotizappIcon } from "@/components/brand/cotizapp-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type DashboardHeaderProps = {
  businessName: string | null;
  logoUrl: string | null;
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
  showSignOut = true,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-header px-4 pt-4 md:px-6">
      <div className="app-chrome-header-bar flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="shrink-0 lg:hidden">
            <CotizappIcon size={40} priority />
          </div>

          <Avatar className="hidden h-10 w-10 border border-white/15 bg-white/10 lg:flex">
            {logoUrl ? <AvatarImage src={logoUrl} alt="Logo del negocio" /> : null}
            <AvatarFallback className="bg-white/10 text-sm font-semibold text-header">
              {getBusinessInitials(businessName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-header/60 lg:block">
              Panel principal
            </p>
            <h1 className="truncate text-lg font-semibold text-header">
              {businessName?.trim() || "Tu negocio"}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-[1.4rem] border border-white/10 bg-white/5 p-1.5 shadow-sm">
          <ThemeToggle />
          {showSignOut ? (
            <SignOutButton className="border-white/15 bg-white/5 text-header hover:bg-white/10 hover:text-header" />
          ) : null}
        </div>
      </div>
    </header>
  );
}
