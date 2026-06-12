"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, Plus, Share2 } from "lucide-react";
import Link from "next/link";

type CotizacionCreadaProps = {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  total: number;
  currency?: string;
  onNewQuotation?: () => void;
};

export function CotizacionCreada({
  quotationId,
  quotationNumber,
  clientName,
  total,
  currency = "ARS",
  onNewQuotation,
}: CotizacionCreadaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(id);
  }, []);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const whatsappText = encodeURIComponent(
    `Hola, te comparto la cotización ${quotationNumber}: ${appUrl}/cotizaciones/${quotationId}`,
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
  const formattedTotal = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(total);

  return (
    <div
      className={`mt-3 flex flex-col gap-4 rounded-xl border border-[#00E5A0]/30 bg-[#00E5A0]/5 p-4 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00E5A0]">
          <CheckCircle2 className="h-5 w-5 text-black" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">¡Cotización guardada!</p>
          <p className="text-xs text-[#8B8FA8]">
            {quotationNumber} · {clientName}
          </p>
        </div>
        <p className="ml-auto text-base font-bold text-[#00E5A0]">
          {formattedTotal}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/cotizaciones/${quotationId}`}
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-[#1A1D27] px-2 py-2 text-center text-xs font-medium text-white transition hover:bg-[#222536] active:opacity-80"
        >
          <Eye className="h-4 w-4 text-[#8B8FA8]" />
          Ver
        </Link>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-[#1A1D27] px-2 py-2 text-center text-xs font-medium text-white transition hover:bg-[#222536] active:opacity-80"
        >
          <Share2 className="h-4 w-4 text-[#8B8FA8]" />
          Compartir
        </a>

        {onNewQuotation && (
          <button
            type="button"
            onClick={onNewQuotation}
            className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-[#1A1D27] px-2 py-2 text-xs font-medium text-white transition hover:bg-[#222536] active:opacity-80"
          >
            <Plus className="h-4 w-4 text-[#8B8FA8]" />
            Nueva
          </button>
        )}
      </div>
    </div>
  );
}
