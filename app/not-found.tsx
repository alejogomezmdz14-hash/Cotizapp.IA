import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { BottomNav } from "@/components/layout/bottom-nav";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { resolveDashboardBranding } from "@/lib/dashboard-branding";
import { getCurrentUser, getProfile, isProfileComplete } from "@/lib/profile";

function PublicNotFound() {
  return (
    <main className="shell-backdrop flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="shell-panel-strong w-full max-w-lg space-y-5 border border-token p-6 text-center sm:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Esa página no existe
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            La página no existe o fue movida.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">Ir al inicio</Link>
          </Button>
          <Button asChild variant="outline" className="bg-background/75">
            <Link href="/sign-in">Iniciar sesión</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export default async function NotFound() {
  const { userId } = await auth();

  if (!userId) {
    return <PublicNotFound />;
  }

  let user = null;
  let profile = null;

  try {
    user = await getCurrentUser();
    profile = user ? await getProfile(user.id).catch(() => null) : null;
  } catch {
    return <PublicNotFound />;
  }

  const branding = isProfileComplete(profile)
    ? await resolveDashboardBranding(profile).catch(() => ({
        businessName: profile?.business_name ?? null,
        logoUrl: null,
      }))
    : {
        businessName: profile?.business_name ?? "Cotizapp",
        logoUrl: null,
      };

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar />
      <div className="shell-backdrop relative flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[rgb(var(--accent-rgb)/0.12)] to-transparent" />
        <DashboardHeader
          businessName={branding.businessName}
          logoUrl={branding.logoUrl}
          avatarUrl={profile?.avatar_url ?? null}
          firstName={profile?.first_name ?? null}
          lastName={profile?.last_name ?? null}
        />
        <main className="flex-1 px-4 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-6 lg:pb-6">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-center">
            <section className="shell-panel-strong shell-highlight w-full overflow-hidden px-6 py-8 text-center sm:px-8 sm:py-10">
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Esa página no existe en Cotizapp
                </h1>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  La página no existe o fue movida. Podés volver al inicio o crear
                  una cotización nueva.
                </p>
              </div>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/dashboard">Volver al inicio</Link>
                </Button>
                <Button asChild variant="outline" className="bg-background/75">
                  <Link href="/cotizaciones">Ver cotizaciones</Link>
                </Button>
                <Button asChild variant="outline" className="bg-background/75">
                  <Link href="/cotizaciones/nueva">Nueva cotización</Link>
                </Button>
              </div>
            </section>
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
