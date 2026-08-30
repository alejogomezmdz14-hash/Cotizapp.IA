import { redirect } from "next/navigation";

import { getProfileLogoUploadState } from "@/app/actions/uploads";
import { CotizappLogo } from "@/components/brand/cotizapp-logo";
import { OnboardingForm } from "@/components/uploads/onboarding-form";
import { getProfile, isProfileComplete, requireUser } from "@/lib/profile";
import { OnboardingLogoStep } from "@/components/uploads/onboarding-logo-step";

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
    // Una sola tarjeta centrada con el paso actual, y nada más.
    // Antes esta pantalla era una grilla de dos columnas: el formulario en una
    // y en la otra un panel con título grande, tres tarjetas de beneficios y un
    // bloque extra. En el celular todo eso quedaba apilado DEBAJO del
    // formulario, así que el alta se sentía interminable aunque el paso en sí
    // fuera corto. El texto de venta no va acá: el usuario ya se registró.
    <main className="shell-backdrop flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <CotizappLogo variant="auto" width={150} priority />
        </div>

        <section className="shell-panel-strong space-y-6 p-5 sm:p-7">
          {onboardingError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {onboardingError}
            </p>
          ) : null}

          {/* El contador y el título de cada paso los pone el propio
              formulario, que es quien sabe en cuál está. */}
          <OnboardingForm
            profile={profile}
            fallbackEmail={user.email ?? null}
          />
        </section>

        <p className="text-center text-xs leading-5 text-muted-foreground">
          Todo esto se puede cambiar después desde Ajustes.
        </p>
      </div>
    </main>
  );
}
