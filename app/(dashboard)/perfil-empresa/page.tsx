import { BusinessProfileForm } from "@/components/profile/business-profile-form";
import { PdfTemplateSettings } from "@/components/profile/pdf-template-settings";
import { getProfileLogoUploadState } from "@/app/actions/uploads";
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
  const logoState = profile?.logo_url
    ? await getProfileLogoUploadState(profile.logo_url)
    : null;
  const saved = isTruthyFlag(searchParams?.saved);
  const savedPdf = searchParams?.saved === "pdf";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="space-y-2">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-[11px] font-medium text-muted-foreground">
          Perfil de empresa
        </span>
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Datos de tu negocio
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          Actualizá los datos de tu negocio y el diseño de tus cotizaciones.
        </p>
      </section>

      <section className="shell-panel-strong p-6 sm:p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold tracking-tight">Tu negocio</h3>
            <BusinessProfileForm
              profile={profile}
              fallbackEmail={user.email ?? null}
              currentLogoUrl={logoState?.previewUrl ?? null}
              currentLogoPath={logoState?.logoPath ?? profile?.logo_url ?? null}
              saved={saved && !savedPdf}
            />
          </div>

          <div className="space-y-4 border-t border-token/80 pt-8">
            <h3 className="text-xl font-semibold tracking-tight">
              Cómo se ve tu cotización
            </h3>
            <PdfTemplateSettings
              initialTemplate={profile?.pdf_template ?? null}
              initialAccentColor={profile?.pdf_accent_color ?? null}
              initialPdfFooter={profile?.pdf_footer ?? null}
              businessName={profile?.business_name ?? null}
              saved={savedPdf}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
