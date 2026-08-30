"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, MapPin, Phone } from "lucide-react";

import { saveOnboarding } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PROFILE_COUNTRIES } from "@/lib/profile-countries";
import { PROFILE_CURRENCIES } from "@/lib/profile-currencies";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

type OnboardingFormProps = {
  profile: Profile | null;
  fallbackEmail: string | null;
};

/**
 * Alta del negocio, de a un paso por pantalla.
 *
 * Antes era un formulario único con siete campos: en un teléfono había que
 * scrollear bastante y era fácil perderse. Acá cada paso entra en la pantalla
 * sin scrollear, que es como se usa la app: parado, con una mano.
 *
 * Los campos de todos los pasos están montados siempre dentro del mismo form, y
 * los que no corresponden al paso actual se ocultan. Así el navegador retiene
 * lo tipeado al ir y volver sin que tengamos que manejar estado, y al final se
 * guarda todo de una sola vez.
 *
 * `required` se aplica SOLO al paso visible: un campo obligatorio oculto haría
 * que el navegador intente enfocar algo invisible y trabe el envío con un error
 * que el usuario no puede resolver.
 */

const PASOS = [
  { titulo: "¿Cómo se llama tu negocio?", icono: Building2 },
  { titulo: "¿Dónde trabajás?", icono: MapPin },
  { titulo: "¿Cómo te contactan?", icono: Phone },
] as const;

const TOTAL_PASOS_ALTA = PASOS.length;
// El cuarto es el logo, que vive en otra pantalla.
const TOTAL_PASOS = TOTAL_PASOS_ALTA + 1;

export function OnboardingForm({
  profile,
  fallbackEmail,
}: OnboardingFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [paso, setPaso] = useState(0);

  const esUltimo = paso === TOTAL_PASOS_ALTA - 1;
  const { titulo, icono: Icono } = PASOS[paso];

  function siguiente() {
    // Valida solo lo visible: los pasos ocultos no llevan `required`.
    if (formRef.current && !formRef.current.reportValidity()) {
      return;
    }
    setPaso((actual) => Math.min(actual + 1, TOTAL_PASOS_ALTA - 1));
  }

  return (
    <form ref={formRef} action={saveOnboarding} className="space-y-6">
      <div className="space-y-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Paso {paso + 1} de {TOTAL_PASOS}
        </span>
        {/* Barra de avance: en un alta de cuatro pasos, saber cuánto falta es
            la diferencia entre seguir y abandonar. */}
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-[rgb(var(--border-rgb)/0.5)]"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL_PASOS}
          aria-valuenow={paso + 1}
        >
          <div
            className="h-full rounded-full bg-accent-token transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ width: `${((paso + 1) / TOTAL_PASOS) * 100}%` }}
          />
        </div>
      </div>

      <div key={paso} className="wizard-step space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-token/80 bg-background text-accent-token">
            <Icono className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {titulo}
          </h2>
        </div>

        <div className={cn("space-y-5", paso !== 0 && "hidden")}>
          <div className="space-y-2">
            <Label htmlFor="business_name">Nombre del negocio</Label>
            <Input
              id="business_name"
              name="business_name"
              placeholder="Ej. Ferretería San Martín"
              defaultValue={profile?.business_name ?? ""}
              required={paso === 0}
              autoComplete="organization"
            />
            <p className="text-sm text-muted-foreground">
              Es el nombre que va a ver tu cliente en la cotización.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">¿A qué te dedicás?</Label>
            <Input
              id="industry"
              name="industry"
              placeholder="Ej. Plomería y gas"
              defaultValue={profile?.industry ?? ""}
              required={paso === 0}
            />
          </div>
        </div>

        <div className={cn("space-y-5", paso !== 1 && "hidden")}>
          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <NativeSelect
              id="country"
              name="country"
              defaultValue={profile?.country ?? "Argentina"}
              required={paso === 1}
            >
              {PROFILE_COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </NativeSelect>
            <p className="text-sm text-muted-foreground">
              Si estás en Argentina, más adelante vas a poder emitir facturas
              electrónicas desde acá.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Moneda</Label>
            <NativeSelect
              id="currency"
              name="currency"
              defaultValue={(profile?.currency ?? "ARS").toUpperCase()}
              required={paso === 1}
            >
              {PROFILE_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className={cn("space-y-5", paso !== 2 && "hidden")}>
          <p className="text-sm leading-6 text-muted-foreground">
            Estos datos se imprimen en tus cotizaciones para que el cliente sepa
            cómo encontrarte.
          </p>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="Ej. +54 261 555 1234"
              defaultValue={profile?.phone ?? ""}
              required={paso === 2}
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              placeholder="Ej. ventas@tunegocio.com"
              defaultValue={profile?.email ?? fallbackEmail ?? ""}
              required={paso === 2}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              name="address"
              placeholder="Ej. Av. San Martín 1234, Mendoza"
              defaultValue={profile?.address ?? ""}
              required={paso === 2}
              autoComplete="street-address"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {paso > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setPaso((actual) => Math.max(actual - 1, 0))}
            className="min-h-12"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Atrás
          </Button>
        ) : null}

        {esUltimo ? (
          <Button type="submit" className="min-h-12 flex-1">
            Continuar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={siguiente} className="min-h-12 flex-1">
            Siguiente
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
