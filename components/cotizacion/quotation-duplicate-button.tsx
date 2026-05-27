"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy } from "lucide-react";

import { duplicateQuotationAction } from "@/app/actions/quotations";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

type QuotationDuplicateButtonProps = {
  quotationId: string;
  variant?: "outline" | "ghost";
  size?: "default" | "sm";
};

export function QuotationDuplicateButton({
  quotationId,
  variant = "outline",
  size = "sm",
}: QuotationDuplicateButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDuplicating, setIsDuplicating] = useState(false);

  async function handleDuplicate(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    setIsDuplicating(true);

    try {
      const result = await duplicateQuotationAction(quotationId);
      toast({
        title: "Cotización duplicada",
        description: `Se creó el borrador ${result.number}.`,
      });
      router.push(`/cotizaciones/nueva?quotationId=${result.quotationId}`);
      router.refresh();
    } catch {
      toast({
        title: "No se pudo duplicar",
        description: "Intentá nuevamente en unos segundos.",
        variant: "error",
      });
    } finally {
      setIsDuplicating(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className="bg-background/75"
      disabled={isDuplicating}
      onClick={handleDuplicate}
    >
      <Copy className="mr-1.5 h-3.5 w-3.5" />
      {isDuplicating ? "Duplicando..." : "Duplicar"}
    </Button>
  );
}
