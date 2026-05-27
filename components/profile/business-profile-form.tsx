"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CreditCard, Mail, ScrollText, Sparkles } from "lucide-react";

import { saveBusinessProfileAction } from "@/app/actions/profile";
import { LogoUploader } from "@/components/uploads/logo-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/types";

type BusinessProfileFormProps = {
  profile: Profile | null;
  fallbackEmail: string | null;
  currentLogoUrl: string | null;
  currentLogoPath: string | null;
  saved?: boolean;
};

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const PROFILE_CURRENCIES = ["ARS", "USD", "EUR", "MXN", "COP", "CLP", "BRL", "UYU"] as const;

export function BusinessProfileForm({
  profile,
  fallbackEmail,
  currentLogoUrl,
  currentLogoPath,
  saved = false,
}: BusinessProfileFormProps) {
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  return (
    <form action={saveBusinessProfileAction} className="space-y-6">
      <LogoUploader
        currentLogoUrl={currentLogoUrl}
        currentLogoPath={currentLogoPath}
        onUploadStateChange={({ isUploading }) => setIsLogoUploading(isUploading)}
      />

      {saved ? (
        <p className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          El perfil de empresa se guardo correctamente.
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 text-accent-token" />
          Identidad comercial
        </div>
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="business_name">Nombre del negocio</Label>
              <Input
                id="business_name"
                name="business_name"
                placeholder="Ej. Ferreteria San Martin"
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {PROFILE_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tax_id">Número fiscal (CUIT, RFC, NIT, RUT)</Label>
              <Input
                id="tax_id"
                name="tax_id"
                placeholder="Ej. 30-12345678-9"
                defaultValue={profile?.tax_id ?? ""}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Mail className="h-3.5 w-3.5 text-accent-token" />
          Contacto del negocio
        </div>
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Ej. 261 555 1234"
                defaultValue={profile?.phone ?? ""}
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
                placeholder="Ej. Rodriguez Pena 3341, Mendoza"
                defaultValue={profile?.address ?? ""}
                autoComplete="street-address"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5 text-accent-token" />
          PDF y pie de página
        </div>
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
          <div className="space-y-2">
            <Label htmlFor="pdf_footer">Pie de página del PDF</Label>
            <textarea
              id="pdf_footer"
              name="pdf_footer"
              rows={4}
              defaultValue={profile?.pdf_footer ?? ""}
              placeholder="Ej. Precios sujetos a cambios sin previo aviso."
              className={textareaClassName}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Este texto se muestra en el pie del PDF junto al nombre del negocio y la
            leyenda de Cotizapp.
          </p>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-token/80 bg-background text-accent-token">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Antes de guardar</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Revisa que el contacto y el pie del PDF representen exactamente como
              quieres enviar tus cotizaciones.
            </p>
          </div>
        </div>

        {isLogoUploading ? (
          <p className="rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Espera a que termine la carga del logo antes de guardar el perfil.
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent-token" />
              Los cambios impactan el dashboard y los PDFs nuevos.
            </div>
            <Button type="button" variant="outline" className="bg-background/75" asChild>
              <Link href="/onboarding">Volver a ver el tour inicial</Link>
            </Button>
          </div>
          <Button type="submit" disabled={isLogoUploading}>
            Guardar perfil
          </Button>
        </div>
      </div>
    </form>
  );
}
