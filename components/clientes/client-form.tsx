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
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo guardar el cliente.";
}

export function ClientForm({
  mode = "create",
  initialValues,
  onSubmit,
  onCancel,
  onSuccess,
  submitLabel,
  className,
}: ClientFormProps) {
  const fieldId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const defaultSubmitLabel =
    mode === "edit" ? "Guardar cambios" : "Guardar cliente";
  const pendingLabel = mode === "edit" ? "Guardando..." : "Creando...";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

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
          <Input
            id={`${fieldId}-phone`}
            name="phone"
            type="tel"
            placeholder="Ej: +54 9 11 1234 5678"
            defaultValue={initialValues?.phone ?? ""}
            disabled={isSubmitting}
            className="border-token bg-background/80"
            minLength={8}
          />
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
