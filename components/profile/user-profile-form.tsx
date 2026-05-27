"use client";

import { useState } from "react";
import { CalendarDays, PhoneCall } from "lucide-react";

import { saveUserProfileAction } from "@/app/actions/profile";
import { AvatarUploader } from "@/components/uploads/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/types";

type UserProfileFormProps = {
  profile: Profile | null;
  userEmail: string | null;
  currentAvatarUrl: string | null;
  currentAvatarPath: string | null;
  saved?: boolean;
};

export function UserProfileForm({
  profile,
  userEmail,
  currentAvatarUrl,
  currentAvatarPath,
  saved = false,
}: UserProfileFormProps) {
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  return (
    <form action={saveUserProfileAction} className="space-y-6">
      <AvatarUploader
        currentAvatarUrl={currentAvatarUrl}
        currentAvatarPath={currentAvatarPath}
        onUploadStateChange={({ isUploading }) => setIsAvatarUploading(isUploading)}
      />

      {saved ? (
        <p className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          El perfil personal se guardó correctamente.
        </p>
      ) : null}

      <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="first_name">Nombre</Label>
            <Input
              id="first_name"
              name="first_name"
              placeholder="Ej. Juan"
              defaultValue={profile?.first_name ?? ""}
              required
              autoComplete="given-name"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="last_name">Apellido</Label>
            <Input
              id="last_name"
              name="last_name"
              placeholder="Ej. Pérez"
              defaultValue={profile?.last_name ?? ""}
              required
              autoComplete="family-name"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email (Google)</Label>
            <Input
              id="email"
              name="email"
              value={userEmail ?? ""}
              readOnly
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono personal</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Ej. +54 261 123 4567"
              defaultValue={profile?.phone ?? ""}
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <Input
              id="country"
              name="country"
              placeholder="Ej. Argentina"
              defaultValue={profile?.country ?? ""}
              autoComplete="country-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input
              id="city"
              name="city"
              placeholder="Ej. Mendoza"
              defaultValue={profile?.city ?? ""}
              autoComplete="address-level2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_date">
              Fecha de nacimiento
              <span className="sr-only">Formato</span>
            </Label>
            <div className="relative">
              <Input
                id="birth_date"
                name="birth_date"
                type="date"
                defaultValue={profile?.birth_date ?? ""}
              />
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-token/80 bg-background text-accent-token">
            <PhoneCall className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Antes de guardar</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Tus datos personales se usan para completar tu cuenta y mostrar tu
              avatar en el header.
            </p>
          </div>
        </div>

        {isAvatarUploading ? (
          <p className="rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Espera a que termine la carga de la foto antes de guardar.
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-accent-token">•</span> Guardado rápido.
            </div>
          </div>
          <Button type="submit" disabled={isAvatarUploading}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </form>
  );
}

