import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { resolveDashboardBranding } from "@/lib/dashboard-branding";
import { getProfile, isProfileComplete, requireUser } from "@/lib/profile";

export const dynamic = "force-dynamic";

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

  const branding = await resolveDashboardBranding(profile).catch(() => ({
    businessName: profile?.business_name ?? null,
    logoUrl: null,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar />
      <div className="shell-backdrop relative flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader
          businessName={branding.businessName}
          logoUrl={branding.logoUrl}
          avatarUrl={profile?.avatar_url ?? null}
          firstName={profile?.first_name ?? null}
          lastName={profile?.last_name ?? null}
        />
        <main className="flex-1 px-4 py-5 pb-[calc(4rem+env(safe-area-inset-bottom))] md:px-8 lg:pb-7">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
