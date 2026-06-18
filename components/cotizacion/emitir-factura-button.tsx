"use client";

import { useState } from "react";
import { Loader2, ReceiptText } from "lucide-react";

import {
  emitirFacturaAction,
  type EmitirFacturaResult,
} from "@/app/actions/facturacion";
import { Button } from "@/components/ui/button";

type EmitirFacturaButtonProps = {
  quotationId: string;
};

export function EmitirFacturaButton({ quotationId }: EmitirFacturaButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmitirFacturaResult | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const res = await emitirFacturaAction(quotationId);
      setResult(res);
    } catch {
      setResult({
        ok: false,
        error: "No pudimos emitir la factura. Probá de nuevo en un momento.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-md border border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
        <p className="text-sm font-semibold text-foreground">Factura emitida ✓</p>
        <p className="mt-1 text-sm text-muted-foreground">
          CAE: <span className="font-medium text-foreground">{result.cae}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Comprobante: {result.numeroFactura} · Vence: {result.vencimiento}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={loading}
        className="min-h-11 w-full sm:w-fit"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ReceiptText className="mr-2 h-4 w-4" />
        )}
        Emitir factura
      </Button>
      {result && !result.ok ? (
        <p className="text-sm text-destructive">{result.error}</p>
      ) : null}
    </div>
  );
}
