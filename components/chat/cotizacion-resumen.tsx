"use client";

import { useMemo, useState } from "react";
import type { ChatSuggestedQuotationItem } from "@/types";
import { formatCurrencyAmount } from "@/lib/formatting";
import { calculateQuotationTotals } from "@/lib/quotation-calculations";
import {
  getQuotationValidityBounds,
  getQuotationValidityPresetDate,
} from "@/lib/quotation-validity";

const validityPresets = [30, 60, 90] as const;

export type CotizacionResumenValues = {
  taxRate: number;
  validUntil: string;
  notes: string | null;
};

type CotizacionResumenProps = {
  items: ChatSuggestedQuotationItem[];
  disabled?: boolean;
  initialTaxRate?: number | null;
  initialValidUntil?: string | null;
  initialNotes?: string | null;
  onConfirm: (values: CotizacionResumenValues) => void;
};

export function CotizacionResumen({
  items,
  disabled = false,
  initialTaxRate = null,
  initialValidUntil = null,
  initialNotes = null,
  onConfirm,
}: CotizacionResumenProps) {
  const [taxInput, setTaxInput] = useState(
    initialTaxRate !== null && initialTaxRate > 0 ? String(initialTaxRate) : "",
  );
  const [validUntil, setValidUntil] = useState(
    initialValidUntil ?? getQuotationValidityPresetDate(30),
  );
  const [notes, setNotes] = useState(initialNotes ?? "");

  const validityBounds = useMemo(() => getQuotationValidityBounds(), []);

  const taxRate = useMemo(() => {
    const parsed = Number.parseFloat(taxInput.trim().replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
  }, [taxInput]);

  const totals = useMemo(
    () => calculateQuotationTotals(items, taxRate),
    [items, taxRate],
  );

  function handleConfirm() {
    if (disabled) {
      return;
    }

    onConfirm({
      taxRate,
      validUntil,
      notes: notes.trim() || null,
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-4 rounded-xl border border-[#2A2D3E] bg-[#1A1D27] p-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-[#8B8FA8]">
          Resumen
        </p>
        <p className="mt-0.5 text-sm text-[#8B8FA8]">
          Últimos detalles antes de revisar la cotización.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="chat-resumen-tax"
          className="text-sm font-medium text-white"
        >
          Impuesto (%)
        </label>
        <input
          id="chat-resumen-tax"
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          step="0.01"
          placeholder="Ej: 21"
          value={taxInput}
          onChange={(event) => setTaxInput(event.target.value)}
          disabled={disabled}
          className="min-h-12 w-full rounded-xl border border-[#2A2D3E] bg-[#0F1117] px-3 text-sm text-white placeholder:text-[#8B8FA8] focus:border-[#00E5A0] focus:outline-none disabled:opacity-50"
        />
        <p className="text-xs text-[#8B8FA8]">
          Dejalo vacío si no aplicás impuesto.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-white">¿Cuándo vence?</p>
        <div className="flex flex-wrap gap-2">
          {validityPresets.map((days) => {
            const presetDate = getQuotationValidityPresetDate(days);
            const isActive = validUntil === presetDate;

            return (
              <button
                key={days}
                type="button"
                disabled={disabled}
                onClick={() => setValidUntil(presetDate)}
                className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition active:scale-[0.97] disabled:opacity-50 ${
                  isActive
                    ? "border-[#00E5A0] bg-[#00E5A0]/10 text-[#00E5A0]"
                    : "border-[#2A2D3E] bg-[#0F1117] text-white hover:border-[#00E5A0]/40"
                }`}
              >
                {days} días
              </button>
            );
          })}
        </div>
        <input
          type="date"
          value={validUntil}
          min={validityBounds.minDate}
          max={validityBounds.maxDate}
          onChange={(event) => setValidUntil(event.target.value)}
          disabled={disabled}
          className="min-h-12 w-full rounded-xl border border-[#2A2D3E] bg-[#0F1117] px-3 text-sm text-white focus:border-[#00E5A0] focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="chat-resumen-notes"
          className="text-sm font-medium text-white"
        >
          Notas (opcional)
        </label>
        <textarea
          id="chat-resumen-notes"
          rows={3}
          placeholder="Condiciones, tiempos o aclaraciones para tu cliente"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-[#2A2D3E] bg-[#0F1117] px-3 py-2 text-sm text-white placeholder:text-[#8B8FA8] focus:border-[#00E5A0] focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between border-t border-[#2A2D3E] pt-3">
        <p className="text-sm font-medium text-[#8B8FA8]">
          Total{taxRate > 0 ? ` (impuesto ${taxRate}%)` : ""}
        </p>
        <p className="text-lg font-bold text-[#00E5A0]">
          {formatCurrencyAmount(totals.total, "ARS")}
        </p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={handleConfirm}
        className="min-h-[52px] w-full rounded-xl bg-[#00E5A0] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#00C984] active:opacity-80 disabled:opacity-50"
      >
        Revisar cotización
      </button>
    </div>
  );
}
