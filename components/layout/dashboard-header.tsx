import { SignOutButton } from "@/components/layout/sign-out-button";
import { BusinessIdentity } from "@/components/layout/business-identity";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type DashboardHeaderProps = {
  businessName: string | null;
  logoUrl: string | null;
};

export function DashboardHeader({
  businessName,
  logoUrl,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-token bg-background/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
        <BusinessIdentity
          businessName={businessName}
          logoUrl={logoUrl}
          subtitle="Panel principal"
          className="min-w-0 flex-1"
          avatarClassName="h-10 w-10"
          nameClassName="text-lg"
          nameElement="h1"
        />

        <div className="shrink-0">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
