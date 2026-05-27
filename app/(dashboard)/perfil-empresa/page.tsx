import { Building2, ImageIcon, ScrollText } from "lucide-react";

import { getProfileLogoUploadState } from "@/app/actions/uploads";
import { BusinessProfileForm } from "@/components/profile/business-profile-form";
import { PdfTemplateSettings } from "@/components/profile/pdf-template-settings";
import { getProfile, requireUser } from "@/lib/profile";

type BusinessProfilePageProps = {
  searchParams?: {
    saved?: string;
  };
};

function isTruthyFlag(value: string | undefined) {
  return value === "1" || value === "pdf";
}

export default async function BusinessProfilePage({
  searchParams,
}: BusinessProfilePageProps) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const logoState = await getProfileLogoUploadState(profile?.logo_url ?? null);
  const saved = isTruthyFlag(searchParams?.saved);
  const savedPdf = searchParams?.saved === "pdf";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] xl:items-end">
          <div className="space-y-5">
            <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Perfil de empresa
            </span>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Centraliza la identidad que aparece en cada cotización
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Actualiza nombre comercial, logo, datos de contacto, moneda y el pie
                del PDF desde una sola pantalla conectada con el resto del flujo.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              {
                title: "Branding",
                description: "Logo y nombre visibles en dashboard y PDF.",
                icon: Building2,
              },
              {
                title: "Documentos",
                description: "Pie de página y moneda unificados para cada envío.",
                icon: ScrollText,
              },
              {
                title: "Activos",
                description: "El logo queda disponible para las nuevas cotizaciones.",
                icon: ImageIcon,
              },
            ].map(({ title, description, icon: Icon }) => (
              <div
                key={title}
                className="rounded-[1.75rem] border border-token bg-background/80 p-4 shadow-sm"
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
        </div>
      </section>

      <section className="shell-panel-strong p-6 sm:p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <BusinessProfileForm
            profile={profile}
            fallbackEmail={user.email ?? null}
            currentLogoUrl={logoState?.previewUrl ?? null}
            currentLogoPath={logoState?.logoPath ?? profile?.logo_url ?? null}
            saved={saved && !savedPdf}
          />

          <div className="border-t border-token/80 pt-6">
            <PdfTemplateSettings
              initialTemplate={profile?.pdf_template ?? null}
              initialAccentColor={profile?.pdf_accent_color ?? null}
              businessName={profile?.business_name ?? null}
              saved={savedPdf}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
