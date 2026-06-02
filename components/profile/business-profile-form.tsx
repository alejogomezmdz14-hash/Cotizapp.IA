"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, CreditCard, Hash, Mail, ScrollText, Sparkles } from "lucide-react";

import { saveBusinessProfileAction } from "@/app/actions/profile";
import { LogoUploader } from "@/components/uploads/logo-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFILE_CURRENCIES } from "@/lib/profile-currencies";
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

export function BusinessProfileForm({
  profile,
  fallbackEmail,
  currentLogoUrl,
  currentLogoPath,
  saved = false,
}: BusinessProfileFormProps) {
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  const savedTaxId = profile?.tax_id?.trim() || null;
  const numberingMode = profile?.quotation_numbering_mode ?? "auto";
  const numberingPrefix = profile?.quotation_prefix ?? "COT";
  const numberingCounter = profile?.quotation_counter ?? 1;

  return (
    <form
      key={`${profile?.id ?? "new-profile"}-${savedTaxId ?? "sin-tax-id"}`}
      action={saveBusinessProfileAction}
      className="space-y-6"
    >
      <LogoUploader
        currentLogoUrl={currentLogoUrl}
        currentLogoPath={currentLogoPath}
        onUploadStateChange={({ isUploading }) => setIsLogoUploading(isUploading)}
      />

      {saved ? (
        <p className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          El perfil de empresa se guardó correctamente.
          {savedTaxId ? (
            <>
              {" "}
              Número fiscal guardado: <span className="font-semibold">{savedTaxId}</span>.
            </>
          ) : null}
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
              <Label htmlFor="tax_id">Número impositivo (CUIT, RFC u otro)</Label>
              <Input
                id="tax_id"
                name="tax_id"
                placeholder="Ej. 30-12345678-9"
                defaultValue={profile?.tax_id ?? ""}
                autoComplete="off"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {savedTaxId
                  ? `Cargado desde tu perfil: ${savedTaxId}`
                  : "Todavía no hay un número fiscal guardado para este negocio."}
              </p>
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
          <Hash className="h-3.5 w-3.5 text-accent-token" />
          Formato de numeración
        </div>
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="quotation_numbering_mode">Modo</Label>
              <select
                id="quotation_numbering_mode"
                name="quotation_numbering_mode"
                defaultValue={numberingMode}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="auto">Automático (el sistema lo genera solo)</option>
                <option value="sequential">Correlativo simple (COT-001, COT-002...)</option>
                <option value="custom">Personalizado (prefijo propio)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotation_prefix">Prefijo</Label>
              <Input
                id="quotation_prefix"
                name="quotation_prefix"
                placeholder="Ej. PRES o COTI"
                defaultValue={numberingPrefix}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotation_counter">Próximo número</Label>
              <Input
                id="quotation_counter"
                name="quotation_counter"
                type="number"
                min={1}
                step={1}
                defaultValue={numberingCounter}
              />
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Las nuevas cotizaciones usarán este formato. El correlativo avanza
            automáticamente al crear cada cotización. Ej: COT-20260601-A3F2
          </p>
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
              Antes de guardar, revisá que tus datos de contacto sean los que
              querés que vean tus clientes.
            </p>
          </div>
        </div>

        {isLogoUploading ? (
          <p className="rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Esperá a que termine la carga del logo antes de guardar el perfil.
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent-token" />
              Los cambios impactan el dashboard y los PDFs nuevos.
            </div>
            <Button type="button" variant="outline" className="bg-background/75" asChild>
              <Link href="/onboarding">Ver tutorial de bienvenida</Link>
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
