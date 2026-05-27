"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deleteQuotationAction,
  duplicateQuotationAction,
  updateQuotationStatusAction,
} from "@/app/actions/quotations";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

type QuotationListActionsProps = {
  quotationId: string;
  initialStatus: string | null;
  reopenHref?: string | null;
};

const statusOptions = [
  {
    value: "draft",
    label: "Borrador",
  },
  {
    value: "pending",
    label: "Enviada",
  },
  {
    value: "accepted",
    label: "Aceptada",
  },
  {
    value: "rejected",
    label: "Rechazada",
  },
] as const;

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo completar la acción sobre la cotización.";
}

export function QuotationListActions({
  quotationId,
  initialStatus,
  reopenHref = null,
}: QuotationListActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState(initialStatus ?? "draft");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(nextStatus: string) {
    setError(null);
    setIsUpdatingStatus(true);

    try {
      const result = await updateQuotationStatusAction(quotationId, nextStatus);
      setStatus(result.status ?? nextStatus);
      toast({
        title: "Estado actualizado",
        description: "La cotización ya refleja el nuevo estado.",
      });
      router.refresh();
    } catch (statusError) {
      setError(getErrorMessage(statusError));
      setStatus(initialStatus ?? "draft");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleDuplicate() {
    setError(null);
    setIsDuplicating(true);

    try {
      const result = await duplicateQuotationAction(quotationId);
      toast({
        title: "Cotización duplicada",
        description: `Se creó el borrador ${result.number}.`,
      });
      router.push(`/cotizaciones/nueva?quotationId=${result.quotationId}`);
      router.refresh();
    } catch (duplicateError) {
      setError(getErrorMessage(duplicateError));
    } finally {
      setIsDuplicating(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Esta cotización se eliminará con sus adjuntos y PDFs asociados. ¿Querés continuar?",
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await deleteQuotationAction(quotationId);
      toast({
        title: "Cotización eliminada",
        description: "La cotización y sus archivos asociados ya no figuran en el panel.",
      });
      router.refresh();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Estado manual</span>
          <select
            value={status}
            className="min-w-[220px] rounded-md border border-token bg-background px-3 py-2 text-sm text-foreground"
            disabled={isUpdatingStatus || isDuplicating || isDeleting}
            onChange={(event) => {
              const nextStatus = event.target.value;
              setStatus(nextStatus);
              void handleStatusChange(nextStatus);
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-3">
          {reopenHref ? (
            <Button
              type="button"
              variant="outline"
              className="bg-background/75"
              onClick={() => router.push(reopenHref)}
              disabled={isUpdatingStatus || isDuplicating || isDeleting}
            >
              Reabrir borrador
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="bg-background/75"
            onClick={() => {
              void handleDuplicate();
            }}
            disabled={isUpdatingStatus || isDuplicating || isDeleting}
          >
            {isDuplicating ? "Duplicando..." : "Duplicar"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
            onClick={() => {
              void handleDelete();
            }}
            disabled={isUpdatingStatus || isDuplicating || isDeleting}
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
