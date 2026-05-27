import { redirect } from "next/navigation";
import { BadgeCheck, Building2, Palette, PhoneCall } from "lucide-react";

import { getProfileLogoUploadState } from "@/app/actions/uploads";
import { OnboardingForm } from "@/components/uploads/onboarding-form";
import { getProfile, isProfileComplete, requireUser } from "@/lib/profile";

const onboardingHighlights = [
  {
    title: "Identidad clara",
    description: "Nombre, rubro y logo para que tus cotizaciones salgan listas.",
    icon: Building2,
  },
  {
    title: "Presentación consistente",
    description: "Moneda, datos y branding conectados con el nuevo shell visual.",
    icon: Palette,
  },
  {
    title: "Contacto disponible",
    description: "Teléfono, email y dirección para acompañar cada envío comercial.",
    icon: PhoneCall,
  },
] as const;

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const logoState = await getProfileLogoUploadState(profile?.logo_url ?? null);

  if (isProfileComplete(profile)) {
    redirect("/dashboard");
  }

  return (
    <main className="shell-backdrop min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
          <section className="order-2 shell-panel-strong shell-highlight flex flex-col justify-between gap-6 p-6 sm:p-8 lg:order-1">
            <div className="space-y-4">
              <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Onboarding
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Terminá la configuración de tu negocio con una superficie más pulida
                </h1>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                  Necesitamos algunos datos para personalizar tus cotizaciones,
                  dejar tu cuenta lista para usar y conectar el branding con el
                  nuevo sistema visual.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {onboardingHighlights.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="rounded-[1.75rem] border border-token bg-background/70 px-4 py-4"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-token/80 bg-background text-accent-token">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.75rem] border border-token bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <BadgeCheck className="h-4 w-4 text-accent-token" />
                Qué vas a dejar listo
              </div>
              Nombre comercial, rubro, moneda, contacto y logo para que las
              futuras cotizaciones ya salgan con mejor presentación.
            </div>
          </section>

          <section className="order-1 shell-panel-strong p-6 sm:p-8 lg:order-2">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
              <div className="space-y-3">
                <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Datos del negocio
                </span>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Configuración inicial
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Completa solo lo necesario para entrar al panel con una base
                    visual y comercial consistente.
                  </p>
                </div>
              </div>

              <OnboardingForm
                profile={profile}
                fallbackEmail={user.email ?? null}
                currentLogoUrl={logoState?.previewUrl ?? null}
                currentLogoPath={logoState?.logoPath ?? profile?.logo_url ?? null}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
