import { redirect } from "next/navigation";
import { BadgeCheck, Building2, Palette, PhoneCall } from "lucide-react";

import { getProfileLogoUploadState } from "@/app/actions/uploads";
import { CotizappLogo } from "@/components/brand/cotizapp-logo";
import { OnboardingForm } from "@/components/uploads/onboarding-form";
import { getProfile, isProfileComplete, requireUser } from "@/lib/profile";
import { OnboardingLogoStep } from "@/components/uploads/onboarding-logo-step";

const onboardingHighlights = [
  {
    title: "Tu marca en cada cotización",
    description: "Tus cotizaciones salen con tu nombre y tu logo, como las de una empresa grande.",
    icon: Building2,
  },
  {
    title: "PDF listo para mandar",
    description: "Generás el PDF y lo compartís por WhatsApp con un toque.",
    icon: Palette,
  },
  {
    title: "Tu cliente sabe cómo contactarte",
    description: "Tu teléfono y email aparecen en cada cotización que enviás.",
    icon: PhoneCall,
  },
] as const;

type OnboardingPageProps = {
  searchParams?: {
    step?: string;
    error?: string;
  };
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const onboardingError = searchParams?.error?.trim() || null;

  let step = searchParams?.step === "logo" ? "logo" : "business";

  if (isProfileComplete(profile)) {
    redirect("/dashboard");
  }

  const needsLogoStep =
    Boolean(profile?.business_name?.trim() && profile?.industry?.trim()) &&
    !profile?.logo_onboarding_completed;

  if (step !== "logo" && needsLogoStep) {
    step = "logo";
  }

  if (step === "logo") {
    if (!profile?.business_name?.trim() || !profile?.industry?.trim()) {
      redirect("/onboarding");
    }

    const logoState = await getProfileLogoUploadState(
      profile?.logo_url ?? null,
      profile,
    );

    return (
      <OnboardingLogoStep
        currentLogoUrl={logoState?.previewUrl ?? null}
        currentLogoPath={logoState?.logoPath ?? profile?.logo_url ?? null}
      />
    );
  }

  return (
    <main className="shell-backdrop min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex justify-center">
          <CotizappLogo variant="auto" width={160} priority />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
          <section className="order-2 shell-panel-strong shell-highlight flex flex-col justify-between gap-6 p-6 sm:p-8 lg:order-1">
            <div className="space-y-4">
              <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Último paso
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Contanos de tu negocio
                </h1>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                  Son 2 minutos. Con estos datos tus cotizaciones salen con tu
                  nombre, tu logo y tus datos de contacto — listas para mandar
                  al cliente.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {onboardingHighlights.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="rounded-md border border-token bg-background/70 px-4 py-4"
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

            <div className="rounded-md border border-token bg-background/70 px-4 py-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <BadgeCheck className="h-4 w-4 text-accent-token" />
                Después de esto, a cotizar
              </div>
              Completás el nombre de tu negocio, a qué te dedicás y cómo
              contactarte. Nada más. Todo se puede cambiar después desde Ajustes.
            </div>
          </section>

          <section className="order-1 shell-panel-strong p-6 sm:p-8 lg:order-2">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
              <div className="space-y-3">
                <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Paso 1 de 2
                </span>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Datos de tu negocio
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Completá lo básico y entrá a tu cuenta. El logo lo cargás
                    en el paso siguiente.
                  </p>
                </div>
              </div>

              {onboardingError ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {onboardingError}
                </p>
              ) : null}

              <OnboardingForm
                profile={profile}
                fallbackEmail={user.email ?? null}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
