"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Loader2, ReceiptText, ShieldAlert } from "lucide-react";

import {
  emitirFacturaAction,
  type EmitirFacturaResult,
} from "@/app/actions/facturacion";
import {
  verificarFacturaAction,
  type VerificarFacturaResult,
} from "@/app/actions/verificar-factura";
import { Button } from "@/components/ui/button";

type EmitirFacturaButtonProps = {
  quotationId: string;
  /** Estado del comprobante (`factura_estado` en `quotations`). */
  estado?: string | null;
};

export function EmitirFacturaButton({
  quotationId,
  estado,
}: EmitirFacturaButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmitirFacturaResult | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [verificacion, setVerificacion] = useState<VerificarFacturaResult | null>(
    null,
  );

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

  async function handleVerificar() {
    setVerificando(true);
    setVerificacion(null);
    try {
      const res = await verificarFacturaAction(quotationId);
      setVerificacion(res);
    } catch {
      setVerificacion({
        ok: false,
        error: "No pudimos verificar la factura. Probá de nuevo en un momento.",
      });
    } finally {
      setVerificando(false);
    }
  }

  // La emisión directa confirmó el CAE, o la verificación contra ARCA lo
  // terminó confirmando: en los dos casos mostramos el mismo cartel.
  let emitida: { cae: string; numeroFactura: string; vencimiento: string } | null =
    null;
  if (result?.ok) {
    emitida = {
      cae: result.cae,
      numeroFactura: result.numeroFactura,
      vencimiento: result.vencimiento,
    };
  } else if (verificacion?.ok && verificacion.emitida) {
    emitida = {
      cae: verificacion.cae,
      numeroFactura: verificacion.numeroFactura,
      vencimiento: verificacion.vencimiento,
    };
  }

  if (emitida) {
    return (
      <div className="rounded-md border border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
        <p className="text-sm font-semibold text-foreground">Factura emitida ✓</p>
        <p className="mt-1 text-sm text-muted-foreground">
          CAE: <span className="font-medium text-foreground">{emitida.cae}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Comprobante: {emitida.numeroFactura} · Vence: {emitida.vencimiento}
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3 bg-background/75">
          <Link
            href={`/api/quotations/${quotationId}/factura-pdf`}
            target="_blank"
          >
            <FileText className="mr-2 h-4 w-4" />
            Ver factura
          </Link>
        </Button>
      </div>
    );
  }

  // Si la verificación ya determinó que ARCA no tiene el comprobante, dejamos
  // de mostrar el panel "en revisión" y caemos al botón normal de emisión,
  // con el aviso de por qué se puede reintentar.
  const mensajeNoEmitida =
    verificacion?.ok && verificacion.emitida === false ? verificacion.mensaje : null;

  if (estado === "en_revision" && mensajeNoEmitida === null) {
    return (
      <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Emisión sin confirmar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No pudimos confirmar con ARCA si esta factura se emitió. Verificá
              antes de reintentar: reintentar sin verificar podría duplicarla.
            </p>
          </div>
        </div>
        <Button
          onClick={handleVerificar}
          disabled={verificando}
          size="sm"
          className="min-h-11 w-full sm:w-fit"
        >
          {verificando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldAlert className="mr-2 h-4 w-4" />
          )}
          Verificar con ARCA
        </Button>
        {verificacion && !verificacion.ok ? (
          <p className="text-sm text-destructive">{verificacion.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mensajeNoEmitida ? (
        <p className="text-sm text-muted-foreground">{mensajeNoEmitida}</p>
      ) : null}
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
