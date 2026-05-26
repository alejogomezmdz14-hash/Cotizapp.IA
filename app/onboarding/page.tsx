import { redirect } from "next/navigation";

import { getProfileLogoUploadState } from "@/app/actions/uploads";
import { OnboardingForm } from "@/components/uploads/onboarding-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProfile, isProfileComplete, requireUser } from "@/lib/profile";

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const logoState = await getProfileLogoUploadState(profile?.logo_url ?? null);

  if (isProfileComplete(profile)) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl justify-center">
        <Card className="w-full border-token bg-surface shadow-xl">
          <CardHeader className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Onboarding
            </span>
            <CardTitle className="text-3xl">
              Terminá la configuración de tu negocio
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              Necesitamos algunos datos para personalizar tus cotizaciones y
              dejar tu cuenta lista para usar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm
              profile={profile}
              fallbackEmail={user.email ?? null}
              currentLogoUrl={logoState?.previewUrl ?? null}
              currentLogoPath={logoState?.logoPath ?? profile?.logo_url ?? null}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
