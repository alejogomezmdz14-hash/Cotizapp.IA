"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { toggleQuotationPaidAction } from "@/app/actions/quotations";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";

type QuotationPaidToggleProps = {
  quotationId: string;
  initialPaidAt: string | null;
};

export function QuotationPaidToggle({
  quotationId,
  initialPaidAt,
}: QuotationPaidToggleProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [paidAt, setPaidAt] = useState(initialPaidAt);
  const [isUpdating, setIsUpdating] = useState(false);
  const isPaid = Boolean(paidAt);

  async function handleToggle() {
    setIsUpdating(true);

    try {
      const result = await toggleQuotationPaidAction(quotationId, !isPaid);
      setPaidAt(result.paidAt);
      toast({
        title: result.paidAt ? "Marcada como pagada" : "Marcada como no pagada",
        description: result.paidAt
          ? "La cotización figura como pagada."
          : "Quitamos el estado de pago.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "No se pudo actualizar el pago",
        description:
          error instanceof Error ? error.message : "Intentá de nuevo.",
        variant: "error",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-token/80 bg-background/70 px-4 py-3">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-token accent-primary"
        checked={isPaid}
        disabled={isUpdating}
        onChange={() => {
          void handleToggle();
        }}
      />
      <div className="space-y-0.5">
        <Label className="cursor-pointer">Marcar como pagada</Label>
        <p className="text-xs text-muted-foreground">
          {isPaid
            ? "Figura como pagada en tu historial."
            : "Activá cuando el cliente haya abonado."}
        </p>
      </div>
    </label>
  );
}
