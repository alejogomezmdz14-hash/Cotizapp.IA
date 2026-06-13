"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, Loader2, Plus, Share2 } from "lucide-react";
import Link from "next/link";

import { confirmQuotationWhatsappShareAction } from "@/app/actions/quotations";
import { shareQuotationPdfFile } from "@/lib/quotation-pdf-share";
import { buildWhatsAppShareHref } from "@/lib/whatsapp";

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
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(id);
  }, []);

  const formattedTotal = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(total);

  async function handleShare() {
    if (isSharing) {
      return;
    }

    setIsSharing(true);
    setShareError(null);

    try {
      // Publica el PDF y genera el link público (sin login para el cliente).
      const result = await confirmQuotationWhatsappShareAction(quotationId);

      const shareOutcome = await shareQuotationPdfFile({
        pdfUrl: `/api/quotations/${encodeURIComponent(quotationId)}/pdf`,
        quotationNumber,
        clientName,
        text: result.whatsappFileText,
      });

      if (shareOutcome === "unsupported") {
        // Desktop o navegador sin compartir archivos: wa.me con link público.
        const whatsappHref = buildWhatsAppShareHref({
          phone: null,
          text: result.whatsappText,
        });
        const openedWindow = window.open(
          whatsappHref,
          "_blank",
          "noopener,noreferrer",
        );
        if (!openedWindow) {
          window.location.href = whatsappHref;
        }
      }
    } catch (error) {
      setShareError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "No se pudo preparar el envío. Probá de nuevo.",
      );
    } finally {
      setIsSharing(false);
    }
  }

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

      {shareError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {shareError}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/cotizaciones/${quotationId}`}
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-[#1A1D27] px-2 py-2 text-center text-xs font-medium text-white transition hover:bg-[#222536] active:opacity-80"
        >
          <Eye className="h-4 w-4 text-[#8B8FA8]" />
          Ver
        </Link>

        <button
          type="button"
          disabled={isSharing}
          onClick={() => {
            void handleShare();
          }}
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-[#1A1D27] px-2 py-2 text-center text-xs font-medium text-white transition hover:bg-[#222536] active:opacity-80 disabled:opacity-50"
        >
          {isSharing ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#8B8FA8]" />
          ) : (
            <Share2 className="h-4 w-4 text-[#8B8FA8]" />
          )}
          {isSharing ? "Preparando..." : "Enviar PDF"}
        </button>

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
