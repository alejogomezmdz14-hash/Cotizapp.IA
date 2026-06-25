"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

type ClientFormFields = Pick<Client, "name" | "email" | "phone" | "address">;

type ClientFormProps = {
  mode?: "create" | "edit";
  initialValues?: Partial<ClientFormFields>;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel?: () => void;
  onSuccess?: () => void;
  submitLabel?: string;
  className?: string;
  /** Código de país por defecto según la cuenta (ej. "54" AR, "52" MX). */
  defaultDialCode?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo guardar el cliente.";
}

// Códigos de país soportados (LATAM). El default lo decide la cuenta, NO se
// asume +54: clientes de México u otros países eligen su código.
const DIAL_CODES = [
  { code: "54", label: "🇦🇷 +54" },
  { code: "52", label: "🇲🇽 +52" },
  { code: "56", label: "🇨🇱 +56" },
  { code: "57", label: "🇨🇴 +57" },
  { code: "51", label: "🇵🇪 +51" },
  { code: "598", label: "🇺🇾 +598" },
  { code: "591", label: "🇧🇴 +591" },
  { code: "595", label: "🇵🇾 +595" },
  { code: "593", label: "🇪🇨 +593" },
] as const;

const KNOWN_DIAL_CODES = DIAL_CODES.map((option) => option.code);

/**
 * Normaliza un teléfono a E.164 (+código + número). No doble-prefija si el
 * número ya trae el código (con + o ya pegado), para no corromper datos viejos.
 */
function toE164(rawPhone: string, dialCode: string): string {
  const trimmed = rawPhone.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  let digits = trimmed.replace(/\D/g, "");

  // Argentina ya con código (54 + 10, o 549 + 10).
  if (/^549\d{10}$/.test(digits) || /^54\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  // Ya empieza con un código conocido y tiene largo plausible → ya viene completo.
  const alreadyCoded = KNOWN_DIAL_CODES.some(
    (code) => digits.startsWith(code) && digits.length >= code.length + 8,
  );
  if (alreadyCoded) {
    return `+${digits}`;
  }

  digits = digits.replace(/^0+/, "");
  return `+${dialCode}${digits}`;
}

export function ClientForm({
  mode = "create",
  initialValues,
  onSubmit,
  onCancel,
  onSuccess,
  submitLabel,
  className,
  defaultDialCode = "54",
}: ClientFormProps) {
  const fieldId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialCode, setDialCode] = useState(defaultDialCode);
  const { toast } = useToast();

  const defaultSubmitLabel =
    mode === "edit" ? "Guardar cambios" : "Guardar cliente";
  const pendingLabel = mode === "edit" ? "Guardando..." : "Creando...";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    // Guardamos el teléfono en E.164 con el código del país elegido, así el
    // link de WhatsApp funciona para AR, MX y demás sin asumir +54.
    const rawPhone = String(formData.get("phone") ?? "");
    if (rawPhone.trim()) {
      formData.set("phone", toE164(rawPhone, dialCode));
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(formData);

      if (mode === "create") {
        form.reset();
      }

      toast({
        title: mode === "edit" ? "Cliente actualizado" : "Cliente guardado",
        description:
          mode === "edit"
            ? "Los cambios del cliente ya quedaron guardados."
            : "El cliente ya está disponible para nuevas cotizaciones.",
      });
      onSuccess?.();
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={cn(
        "space-y-4 rounded-[12px] border border-token bg-surface p-6",
        className,
      )}
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label className="text-muted-foreground" htmlFor={`${fieldId}-name`}>
          Nombre
        </Label>
        <Input
          id={`${fieldId}-name`}
          name="name"
          placeholder="Ej. Constructora Andina"
          defaultValue={initialValues?.name ?? ""}
          disabled={isSubmitting}
          className="border-token bg-background/80"
          required
          maxLength={80}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-muted-foreground" htmlFor={`${fieldId}-email`}>
            Email
          </Label>
          <Input
            id={`${fieldId}-email`}
            name="email"
            type="email"
            placeholder="Ej. juan.perez@gmail.com"
            defaultValue={initialValues?.email ?? ""}
            disabled={isSubmitting}
            className="border-token bg-background/80"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground" htmlFor={`${fieldId}-phone`}>
            Teléfono
          </Label>
          <div className="flex gap-2">
            <select
              aria-label="Código de país"
              value={dialCode}
              onChange={(event) => setDialCode(event.target.value)}
              disabled={isSubmitting}
              className="h-11 shrink-0 rounded-md border border-input bg-background/80 px-2 text-base text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {DIAL_CODES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              id={`${fieldId}-phone`}
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="11 1234 5678"
              defaultValue={initialValues?.phone ?? ""}
              disabled={isSubmitting}
              className="flex-1 border-token bg-background/80"
              minLength={8}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Elegí el país y escribí el número local (sin el código).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground" htmlFor={`${fieldId}-address`}>
          Dirección
        </Label>
        <textarea
          id={`${fieldId}-address`}
          name="address"
          rows={4}
          placeholder="Dirección o referencia de entrega"
          defaultValue={initialValues?.address ?? ""}
          disabled={isSubmitting}
          className="flex min-h-28 w-full rounded-md border border-token bg-background/80 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="border-token bg-surface text-foreground hover:bg-surface-2"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? pendingLabel : submitLabel ?? defaultSubmitLabel}
        </Button>
      </div>
    </form>
  );
}
