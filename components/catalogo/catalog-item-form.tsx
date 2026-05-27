"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import type { CatalogItem } from "@/types";

type CatalogItemFormFields = Pick<
  CatalogItem,
  "name" | "description" | "unit" | "price" | "category"
>;

type CatalogItemFormProps = {
  mode?: "create" | "edit";
  initialValues?: Partial<CatalogItemFormFields>;
  categorySuggestions?: string[];
  unitSuggestions?: string[];
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

  return "No se pudo guardar el ítem del catálogo.";
}

export function CatalogItemForm({
  mode = "create",
  initialValues,
  categorySuggestions = [],
  unitSuggestions = [],
  onSubmit,
  onCancel,
  onSuccess,
  submitLabel,
  className,
}: CatalogItemFormProps) {
  const fieldId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const defaultSubmitLabel =
    mode === "edit" ? "Guardar cambios" : "Guardar ítem";
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
        title: mode === "edit" ? "Ítem actualizado" : "Ítem guardado",
        description:
          mode === "edit"
            ? "Los cambios del catálogo ya quedaron guardados."
            : "El ítem ya está disponible para futuras cotizaciones.",
      });
      onSuccess?.();
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={cn("space-y-4", className)} onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-name`}>Nombre</Label>
        <Input
          id={`${fieldId}-name`}
          name="name"
          placeholder="Ej. Cemento portland x 50 kg"
          defaultValue={initialValues?.name ?? ""}
          disabled={isSubmitting}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-category`}>Categoría</Label>
          <Input
            id={`${fieldId}-category`}
            name="category"
            list={`${fieldId}-category-suggestions`}
            placeholder="Ej. Materiales"
            defaultValue={initialValues?.category ?? ""}
            disabled={isSubmitting}
          />
          <datalist id={`${fieldId}-category-suggestions`}>
            {categorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${fieldId}-unit`}>Unidad</Label>
          <Input
            id={`${fieldId}-unit`}
            name="unit"
            list={`${fieldId}-unit-suggestions`}
            placeholder="Ej. bolsa, m2, unidad"
            defaultValue={initialValues?.unit ?? ""}
            disabled={isSubmitting}
          />
          <datalist id={`${fieldId}-unit-suggestions`}>
            {unitSuggestions.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-price`}>Precio</Label>
        <Input
          id={`${fieldId}-price`}
          name="price"
          inputMode="decimal"
          type="text"
          placeholder="0.00"
          defaultValue={
            typeof initialValues?.price === "number"
              ? initialValues.price.toString()
              : ""
          }
          disabled={isSubmitting}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${fieldId}-description`}>Descripción</Label>
        <textarea
          id={`${fieldId}-description`}
          name="description"
          rows={4}
          placeholder="Detalle breve para reutilizar este ítem en futuras cotizaciones"
          defaultValue={initialValues?.description ?? ""}
          disabled={isSubmitting}
          className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
