import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { resolveDashboardBranding } from "@/lib/dashboard-branding";
import { getProfile, isProfileComplete, requireUser } from "@/lib/profile";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (!isProfileComplete(profile)) {
    redirect("/onboarding");
  }

  const branding = await resolveDashboardBranding(profile);

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar
        businessName={branding.businessName}
        logoUrl={branding.logoUrl}
      />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader
          businessName={branding.businessName}
          logoUrl={branding.logoUrl}
        />
        <main className="flex-1 px-4 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-6 lg:pb-6">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
