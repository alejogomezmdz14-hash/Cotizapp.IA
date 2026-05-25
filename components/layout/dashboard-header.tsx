import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type DashboardHeaderProps = {
  businessName: string | null;
};

export function DashboardHeader({ businessName }: DashboardHeaderProps) {
  const displayName = businessName || "Tu negocio";

  return (
    <header className="sticky top-0 z-30 border-b border-token bg-background/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Panel principal</p>
          <h1 className="truncate text-lg font-semibold" title={displayName}>
            {displayName}
          </h1>
        </div>

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
