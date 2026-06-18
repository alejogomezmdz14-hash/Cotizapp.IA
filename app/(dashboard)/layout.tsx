import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { getClerkAuth } from "@/lib/auth/clerk-session";
import { hasActivePlanFromClaims } from "@/lib/auth/plan";
import { resolveDashboardBranding } from "@/lib/dashboard-branding";
import { getProfile, isProfileComplete, requireUser } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Segunda capa de autorización (el middleware es la primera). Validamos el
  // plan antes de tocar el perfil para no crear perfiles de usuarios sin acceso.
  const { userId, sessionClaims } = await getClerkAuth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!hasActivePlanFromClaims(sessionClaims)) {
    redirect("/waitlist");
  }

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
        <main className="flex-1 px-4 py-5 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-8 lg:pb-7">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
