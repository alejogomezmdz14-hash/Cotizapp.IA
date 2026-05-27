import Link from "next/link";

import { BottomNav } from "@/components/layout/bottom-nav";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { resolveDashboardBranding } from "@/lib/dashboard-branding";
import { getCurrentUser, getProfile, isProfileComplete } from "@/lib/profile";

export default async function NotFound() {
  const user = await getCurrentUser();
  const profile = user ? await getProfile(user.id).catch(() => null) : null;
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
      <Sidebar
        businessName={branding.businessName}
        logoUrl={branding.logoUrl}
      />
      <div className="shell-backdrop relative flex min-h-screen min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[rgb(var(--accent-rgb)/0.12)] to-transparent" />
        <DashboardHeader
          businessName={branding.businessName}
          logoUrl={branding.logoUrl}
          showSignOut={Boolean(user)}
        />
        <main className="flex-1 px-4 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] md:px-6 lg:pb-6">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-center">
            <section className="shell-panel-strong shell-highlight w-full overflow-hidden px-6 py-8 text-center sm:px-8 sm:py-10">
              <span className="inline-flex rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Error 404
              </span>
              <div className="mt-4 space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Esa pagina no existe en Cotizapp
                </h1>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  La ruta que intentaste abrir no esta disponible o ya cambio. Puedes
                  volver al dashboard, revisar tus cotizaciones o crear una nueva sin
                  perder la navegacion principal.
                </p>
              </div>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/dashboard">Ir al dashboard</Link>
                </Button>
                <Button asChild variant="outline" className="bg-background/75">
                  <Link href="/cotizaciones">Ver cotizaciones</Link>
                </Button>
                <Button asChild variant="outline" className="bg-background/75">
                  <Link href="/cotizaciones/nueva">Nueva cotizacion</Link>
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
