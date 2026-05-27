"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  isLoading = false,
  onConfirm,
  onCancel,
  className,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Cerrar diálogo"
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className={cn(
          "relative z-10 w-full max-w-md rounded-[1.75rem] border border-token bg-background p-6 shadow-2xl",
          className,
        )}
      >
        <div className="space-y-2">
          <h2 id="confirm-dialog-title" className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <p
            id="confirm-dialog-description"
            className="text-sm leading-6 text-muted-foreground"
          >
            {description}
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-token bg-background text-foreground"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Procesando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
