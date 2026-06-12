"use client";

import { Building2, CreditCard, Mail, Sparkles } from "lucide-react";

import { saveOnboarding } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFILE_CURRENCIES } from "@/lib/profile-currencies";
import type { Profile } from "@/types";

type OnboardingFormProps = {
  profile: Profile | null;
  fallbackEmail: string | null;
};

export function OnboardingForm({
  profile,
  fallbackEmail,
}: OnboardingFormProps) {
  return (
    <form action={saveOnboarding} className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 text-accent-token" />
          Identidad del negocio
        </div>
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
          <div className="mb-4 rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            Estos datos se usan para presentar tu marca y completar la información
            principal de las cotizaciones.
          </div>

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
              <select
                id="currency"
                name="currency"
                defaultValue={(profile?.currency ?? "ARS").toUpperCase()}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {PROFILE_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Mail className="h-3.5 w-3.5 text-accent-token" />
          Contacto comercial
        </div>
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Ej. +54 261 555 1234"
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
                placeholder="Ej. Av. San Martín 1234, Mendoza"
                defaultValue={profile?.address ?? ""}
                autoComplete="street-address"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-token/80 bg-background text-accent-token">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Antes de continuar</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Revisa que la moneda y los datos de contacto representen la forma en
              que quieres que tu negocio aparezca en las cotizaciones.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent-token" />
            Al guardar vas al siguiente paso para subir tu logo.
          </div>
          <Button type="submit">Continuar</Button>
        </div>
      </div>
    </form>
  );
}
