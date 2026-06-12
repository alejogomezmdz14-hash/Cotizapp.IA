import { Loader2 } from "lucide-react";
import type { ChatSuggestedQuotationItem } from "@/types";
import { formatCurrencyAmount, formatDateOnly } from "@/lib/formatting";
import { calculateQuotationTotals } from "@/lib/quotation-calculations";

type CotizacionPreviewProps = {
  clientName: string;
  items: ChatSuggestedQuotationItem[];
  taxRate?: number | null;
  validUntil?: string | null;
  notes?: string | null;
  isSaving?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
};

export function CotizacionPreview({
  clientName,
  items,
  taxRate = null,
  validUntil = null,
  notes = null,
  isSaving = false,
  onConfirm,
  onEdit,
}: CotizacionPreviewProps) {
  const effectiveTaxRate = taxRate ?? 0;
  const totals = calculateQuotationTotals(items, effectiveTaxRate);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#2A2D3E] bg-[#1A1D27] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#8B8FA8]">
            Cotización para
          </p>
          <p className="mt-0.5 text-base font-semibold text-white">
            {clientName}
          </p>
        </div>
        <span className="rounded-lg bg-[#0F1117] px-2.5 py-1 text-xs font-medium text-[#8B8FA8]">
          Borrador
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="flex items-center justify-between gap-2 rounded-lg bg-[#0F1117] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {item.name}
              </p>
              <p className="text-xs text-[#8B8FA8]">
                {item.quantity} {item.unit} ×{" "}
                {formatCurrencyAmount(item.unitPrice, "ARS")}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-white">
              {formatCurrencyAmount(item.quantity * item.unitPrice, "ARS")}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-[#2A2D3E] pt-3">
        {effectiveTaxRate > 0 ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <p className="text-[#8B8FA8]">Subtotal</p>
              <p className="font-medium text-white">
                {formatCurrencyAmount(totals.subtotal, "ARS")}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-[#8B8FA8]">Impuesto ({effectiveTaxRate}%)</p>
              <p className="font-medium text-white">
                {formatCurrencyAmount(totals.taxAmount, "ARS")}
              </p>
            </div>
          </>
        ) : null}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#8B8FA8]">Total</p>
          <p className="text-xl font-bold text-[#00E5A0]">
            {formatCurrencyAmount(totals.total, "ARS")}
          </p>
        </div>
        {validUntil ? (
          <div className="flex items-center justify-between text-sm">
            <p className="text-[#8B8FA8]">Vence</p>
            <p className="font-medium text-white">{formatDateOnly(validUntil)}</p>
          </div>
        ) : null}
      </div>

      {notes ? (
        <div className="rounded-lg bg-[#0F1117] px-3 py-2.5">
          <p className="text-xs uppercase tracking-wider text-[#8B8FA8]">
            Notas
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-white">{notes}</p>
        </div>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={isSaving}
          onClick={onEdit}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[#2A2D3E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#222536] active:opacity-80 disabled:opacity-50"
        >
          Editar
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onConfirm}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#00E5A0] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#00C984] active:opacity-80 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Confirmar y guardar"
          )}
        </button>
      </div>
    </div>
  );
}
