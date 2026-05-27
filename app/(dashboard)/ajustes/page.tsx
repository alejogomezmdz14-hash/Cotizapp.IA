import {
  Bell,
  Building2,
  Heart,
  Info,
  Palette,
  Settings,
  User,
} from "lucide-react";

import packageJson from "@/package.json";
import { AppearanceSettingsForm } from "@/components/settings/appearance-settings-form";
import { AccountSettingsPanel } from "@/components/settings/account-settings-panel";
import { NotificationSettingsPanel } from "@/components/settings/notification-settings-panel";
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
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Settings className="h-3.5 w-3.5" />
            Ajustes
          </span>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Configuración de tu cuenta
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Gestioná perfil, empresa, apariencia, notificaciones y opciones de
              cuenta desde un solo lugar.
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
          title="Notificaciones"
          description="Preferencias de recordatorios y resúmenes (en desarrollo)."
          icon={Bell}
          className="lg:col-span-2"
        >
          <NotificationSettingsPanel />
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Cuenta"
          description="Email de acceso, cierre de sesión y eliminación de cuenta."
          icon={User}
          className="lg:col-span-2"
        >
          <AccountSettingsPanel email={user.email ?? null} />
        </SettingsSectionCard>

        <SettingsSectionCard
          title="Acerca de"
          description="Información de la app y enlaces legales."
          icon={Info}
          className="lg:col-span-2"
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Versión:</span>{" "}
              {packageJson.version}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <span className="text-accent-token">Términos y condiciones (próximamente)</span>
              <span className="text-accent-token">
                Política de privacidad (próximamente)
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-foreground">
              Hecho con <Heart className="h-4 w-4 fill-red-500 text-red-500" /> por
              Cotizapp.IA
            </p>
          </div>
        </SettingsSectionCard>
      </div>
    </div>
  );
}
