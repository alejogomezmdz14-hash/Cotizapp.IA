"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, ChevronDown, Hash, Mail, Sparkles } from "lucide-react";

import { saveBusinessProfileAction } from "@/app/actions/profile";
import { LogoUploader } from "@/components/uploads/logo-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFILE_CURRENCIES } from "@/lib/profile-currencies";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

type BusinessProfileFormProps = {
  profile: Profile | null;
  fallbackEmail: string | null;
  currentLogoUrl: string | null;
  currentLogoPath: string | null;
  saved?: boolean;
};

export function BusinessProfileForm({
  profile,
  fallbackEmail,
  currentLogoUrl,
  currentLogoPath,
  saved = false,
}: BusinessProfileFormProps) {
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [showAdvancedNumbering, setShowAdvancedNumbering] = useState(
    () => (profile?.quotation_numbering_mode ?? "auto") !== "auto",
  );

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
          Tus datos de negocio se guardaron correctamente.
          {savedTaxId ? (
            <>
              {" "}
              Número fiscal guardado: <span className="font-semibold">{savedTaxId}</span>.
            </>
          ) : null}
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 text-accent-token" />
          Tu negocio
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
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
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
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Hash className="h-3.5 w-3.5 text-accent-token" />
          Numeración
        </div>
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
          {!showAdvancedNumbering ? (
            <>
              <input type="hidden" name="quotation_numbering_mode" value="auto" />
              <input type="hidden" name="quotation_prefix" value={numberingPrefix} />
              <input type="hidden" name="quotation_counter" value={numberingCounter} />
              <p className="text-sm font-medium text-foreground">
                Automático (el sistema lo genera solo)
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Tus cotizaciones se numeran solas: COT-001, COT-002...
              </p>
            </>
          ) : (
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
                  <option value="sequential">
                    Numeración automática: COT-001, COT-002...
                  </option>
                  <option value="custom">Con texto propio: ej. INST-001</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotation_prefix">Prefijo</Label>
                <Input
                  id="quotation_prefix"
                  name="quotation_prefix"
                  placeholder="Ej. INST"
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
          )}

          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-token hover:underline"
            onClick={() => setShowAdvancedNumbering((current) => !current)}
          >
            {showAdvancedNumbering ? "Usar numeración automática" : "Opciones avanzadas"}
            <ChevronDown
              className={cn("h-4 w-4 transition", showAdvancedNumbering && "rotate-180")}
            />
          </button>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
        {isLogoUploading ? (
          <p className="mb-4 rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Esperá a que termine la carga del logo antes de guardar.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent-token" />
            Los cambios impactan el dashboard y los PDFs nuevos.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="min-h-12 bg-background/75" asChild>
              <Link href="/onboarding">Ver tutorial de bienvenida</Link>
            </Button>
            <Button type="submit" className="min-h-12 w-full sm:w-auto" disabled={isLogoUploading}>
              Guardar datos
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
