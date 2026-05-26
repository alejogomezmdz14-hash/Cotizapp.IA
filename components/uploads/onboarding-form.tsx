"use client";

import { useState } from "react";

import { saveOnboarding } from "@/app/actions/profile";
import { LogoUploader } from "@/components/uploads/logo-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/types";

type OnboardingFormProps = {
  profile: Profile | null;
  fallbackEmail: string | null;
  currentLogoUrl: string | null;
  currentLogoPath: string | null;
};

export function OnboardingForm({
  profile,
  fallbackEmail,
  currentLogoUrl,
  currentLogoPath,
}: OnboardingFormProps) {
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  return (
    <form action={saveOnboarding} className="space-y-5">
      <LogoUploader
        currentLogoUrl={currentLogoUrl}
        currentLogoPath={currentLogoPath}
        onUploadStateChange={({ isUploading }) => setIsLogoUploading(isUploading)}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="business_name">Nombre del negocio</Label>
          <Input
            id="business_name"
            name="business_name"
            placeholder="Ej. Ferretería San Martín"
            defaultValue={profile?.business_name ?? ""}
            required
            autoComplete="organization"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">Rubro</Label>
          <Input
            id="industry"
            name="industry"
            placeholder="Ej. Materiales de construcción"
            defaultValue={profile?.industry ?? ""}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <Input
            id="currency"
            name="currency"
            placeholder="Ej. MXN"
            defaultValue={profile?.currency ?? "MXN"}
            required
            autoCapitalize="characters"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Ej. +52 81 1234 5678"
            defaultValue={profile?.phone ?? ""}
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Ej. ventas@tunegocio.com"
            defaultValue={profile?.email ?? fallbackEmail ?? ""}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Dirección</Label>
          <Input
            id="address"
            name="address"
            placeholder="Ej. Av. Principal 123, Monterrey"
            defaultValue={profile?.address ?? ""}
            autoComplete="street-address"
          />
        </div>
      </div>

      {isLogoUploading ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          Espera a que termine la carga del logo antes de guardar el onboarding.
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={isLogoUploading}
        className="w-full bg-accent-token text-black hover:bg-accent-hover"
      >
        Guardar y continuar
      </Button>
    </form>
  );
}
