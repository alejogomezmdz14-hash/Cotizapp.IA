import { requireUser, getProfile } from "@/lib/profile";
import { getProfileAvatarUploadState } from "@/app/actions/uploads";

import { UserProfileForm } from "@/components/profile/user-profile-form";

type UserProfilePageProps = {
  searchParams?: {
    saved?: string;
  };
};

export default async function UserProfilePage({
  searchParams,
}: UserProfilePageProps) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const avatarState = await getProfileAvatarUploadState(profile?.avatar_url ?? null);
  const saved = searchParams?.saved === "1";

  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] xl:items-end">
          <div className="space-y-5">
            <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Perfil personal
            </span>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Tu identidad de usuario
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Actualizá foto y datos personales para que tu avatar aparezca en
                el header y tengas la cuenta completa.
              </p>
            </div>
          </div>

          {/* Acá había dos tarjetas con ícono y borde que parecían botones
              ("Datos personales" y "Perfil de empresa") pero no tenían ni link
              ni onClick: el usuario las tocaba antes de llegar al primer campo
              del formulario y no pasaba nada. */}
        </div>
      </section>

      <section className="shell-panel-strong p-6 sm:p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <UserProfileForm
            profile={profile}
            userEmail={user.email ?? null}
            currentAvatarUrl={avatarState?.previewUrl ?? null}
            currentAvatarPath={avatarState?.avatarPath ?? profile?.avatar_url ?? null}
            saved={saved}
          />
        </div>
      </section>
    </div>
  );
}

