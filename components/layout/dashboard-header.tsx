import { BusinessAvatar } from "@/components/layout/business-avatar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type DashboardHeaderProps = {
  businessName: string | null;
  logoUrl: string | null;
  showSignOut?: boolean;
};

export function DashboardHeader({
  businessName,
  logoUrl,
  showSignOut = true,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[rgba(17,19,24,0.9)] px-4 py-3 backdrop-blur-md md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BusinessAvatar businessName={businessName} logoUrl={logoUrl} />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-header/60">
              Panel principal
            </p>
            <h1 className="truncate text-base font-medium tracking-[-0.01em] text-header">
              {businessName?.trim() || "Tu negocio"}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          {showSignOut ? (
            <SignOutButton className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-header hover:bg-white/10 hover:text-header" />
          ) : null}
        </div>
      </div>
    </header>
  );
}
