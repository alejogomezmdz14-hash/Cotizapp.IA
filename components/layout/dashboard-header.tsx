import { SignOutButton } from "@/components/layout/sign-out-button";
import { BusinessIdentity } from "@/components/layout/business-identity";
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
    <header className="sticky top-0 z-30 px-4 pt-4 md:px-6">
      <div className="shell-panel flex items-center justify-between gap-4 px-4 py-4">
        <BusinessIdentity
          businessName={businessName}
          logoUrl={logoUrl}
          subtitle="Panel principal"
          className="min-w-0 flex-1"
          avatarClassName="h-10 w-10 shadow-sm"
          nameClassName="text-lg"
          subtitleClassName="text-xs font-medium uppercase tracking-[0.18em]"
          nameElement="h1"
        />

        <div className="flex shrink-0 items-center gap-2 rounded-[1.4rem] border border-token bg-background/70 p-1.5 shadow-sm">
          <ThemeToggle />
          {showSignOut ? <SignOutButton /> : null}
        </div>
      </div>
    </header>
  );
}
