import {
  Building2,
  Heart,
  Palette,
  Settings,
  User,
} from "lucide-react";

import packageJson from "@/package.json";
import { AppearanceSettingsForm } from "@/components/settings/appearance-settings-form";
import { AccountSettingsPanel } from "@/components/settings/account-settings-panel";
import { SettingsSectionCard } from "@/components/settings/settings-section-card";
import { getProfile, requireUser } from "@/lib/profile";

type SettingsPageProps = {
  searchParams?: {
    saved?: string;
  };
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const appearanceSaved = searchParams?.saved === "appearance";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="space-y-4">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-token bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <Settings className="h-3.5 w-3.5" />
            Ajustes
          </span>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Configuración de tu cuenta
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Gestioná perfil, empresa, apariencia y cuenta desde un solo lugar.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsSectionCard
          title="Perfil personal"
          description="Foto, nombre, apellido, teléfono, país, ciudad y fecha de nacimiento."
          icon={User}
          href="/perfil-usuario"
        />

        <SettingsSectionCard
          title="Mi empresa"
          description="Logo, nombre del negocio, rubro, moneda, contacto, número fiscal y pie de PDF."
          icon={Building2}
          href="/perfil-empresa"
        />

        <SettingsSectionCard
          title="Apariencia"
          description="Tema claro/oscuro y color de acento para tus PDFs."
          icon={Palette}
          className="lg:col-span-2"
        >
          <AppearanceSettingsForm
            initialTheme={profile?.theme ?? "dark"}
            initialPdfAccentColor={profile?.pdf_accent_color ?? null}
            saved={appearanceSaved}
          />
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Cuenta"
          description="Email de acceso, cierre de sesión y eliminación de cuenta."
          icon={User}
          className="lg:col-span-2"
        >
          <AccountSettingsPanel email={user.email ?? null} />
        </SettingsSectionCard>
      </div>

      <footer className="rounded-md border border-token/80 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
        <p>
          Versión {packageJson.version} · Términos y condiciones · Política de privacidad
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-foreground">
          Hecho con <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" /> por
          Cotizapp.IA
        </p>
      </footer>
    </div>
  );
}
