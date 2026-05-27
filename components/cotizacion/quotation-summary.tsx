import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowUpRight, ReceiptText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotationShareActions } from "@/components/cotizacion/quotation-share-actions";
import { Separator } from "@/components/ui/separator";
import { calculateQuotationTotals } from "@/lib/quotation-calculations";
import { formatCurrencyAmount, formatDateOnly } from "@/lib/formatting";
import { sanitizeQuotationValidityDate } from "@/lib/quotation-validity";

type QuotationSummaryProps = {
  items: Array<{
    quantity: number;
    unitPrice: number;
  }>;
  currency: string | null;
  taxRate: number;
  validUntil: string;
  isSubmitting?: boolean;
  isSaved?: boolean;
  quotationId?: string | null;
  draftNumber?: string | null;
  pdfGeneratedAt?: string | null;
  shareToken?: string | null;
  sentAt?: string | null;
  shareStatus?: string | null;
  onStateChange?: (state: {
    pdfGeneratedAt: string | null;
    shareToken: string | null;
    sentAt: string | null;
    status: string | null;
  }) => void;
};

export function QuotationSummary({
  items,
  currency,
  taxRate,
  validUntil,
  isSubmitting = false,
  isSaved = false,
  quotationId = null,
  draftNumber = null,
  pdfGeneratedAt = null,
  shareToken = null,
  sentAt = null,
  shareStatus = null,
  onStateChange,
}: QuotationSummaryProps) {
  const totals = calculateQuotationTotals(items, taxRate);

  return (
    <Card className="shell-panel-strong shell-highlight overflow-hidden shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xl">Resumen del borrador</CardTitle>
            <CardDescription className="leading-6">
              Los calculos se actualizan en tiempo real para que llegues al guardado
              con contexto claro.
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-token bg-background/70 p-3 text-accent-token">
            <ReceiptText className="h-5 w-5" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Items cargados
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {items.length}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Estado del borrador
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {isSaved ? "Guardado y bloqueado" : "Listo para guardar"}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">
                {formatCurrencyAmount(totals.subtotal, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Impuesto ({taxRate}%)</span>
              <span className="font-medium text-foreground">
                {formatCurrencyAmount(totals.taxAmount, currency)}
              </span>
            </div>
          </div>
        </div>

        <Separator className="bg-border/70" />

        <div className="flex items-start justify-between gap-3 rounded-[1.5rem] border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)] px-4 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Total estimado</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrencyAmount(totals.total, currency)}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" />
            Borrador
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Validez</p>
          <p className="mt-1 text-muted-foreground">
            {validUntil
              ? formatDateOnly(sanitizeQuotationValidityDate(validUntil))
              : "Sin fecha definida"}
          </p>
        </div>

        {draftNumber ? (
          <div className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            Borrador guardado con el numero <span className="font-semibold">{draftNumber}</span>.
            Ahora puedes sumar adjuntos antes de salir.
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-4 w-4 text-accent-token" />
              Guardado controlado
            </div>
            Al guardar se crea una cotizacion en estado borrador, lista para sumar
            adjuntos y preparar la salida por PDF o WhatsApp.
          </div>
        )}

        {quotationId && draftNumber ? (
          <QuotationShareActions
            quotationId={quotationId}
            quotationNumber={draftNumber}
            initialPdfGeneratedAt={pdfGeneratedAt}
            initialShareToken={shareToken}
            initialSentAt={sentAt}
            initialStatus={shareStatus}
            onStateChange={onStateChange}
          />
        ) : null}

        <Button
          type="submit"
          className="w-full bg-accent-token text-black hover:bg-accent-hover"
          disabled={isSubmitting || isSaved}
        >
          {isSubmitting
            ? "Guardando borrador..."
            : isSaved
              ? "Borrador guardado"
              : "Guardar cotizacion"}
        </Button>
      </CardContent>
    </Card>
  );
}
