import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActionHint } from "@/components/ui/action-hint";
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
  saveDisabled?: boolean;
  clientMissing?: boolean;
  quotationId?: string | null;
  draftNumber?: string | null;
  pdfGeneratedAt?: string | null;
  shareToken?: string | null;
  sentAt?: string | null;
  shareStatus?: string | null;
  hideSaveButton?: boolean;
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
  saveDisabled = false,
  clientMissing = false,
  quotationId = null,
  draftNumber = null,
  pdfGeneratedAt = null,
  shareToken = null,
  sentAt = null,
  shareStatus = null,
  hideSaveButton = false,
  onStateChange,
}: QuotationSummaryProps) {
  const totals = calculateQuotationTotals(items, taxRate);

  return (
    <Card className="shell-panel-strong shell-highlight overflow-hidden shadow-none">
      <CardHeader>
        <CardTitle className="text-xl">Resumen</CardTitle>
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
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrencyAmount(totals.total, currency)}
            </p>
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
            Borrador guardado con el número <span className="font-semibold">{draftNumber}</span>.
            Ahora podés sumar adjuntos antes de salir.
          </div>
        ) : null}

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

        {hideSaveButton ? null : (
          <div className="space-y-1.5">
            <Button
              type="submit"
              className="min-h-12 w-full bg-accent-token text-black hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50"
              disabled={
                saveDisabled || isSubmitting || isSaved || items.length === 0 || clientMissing
              }
              aria-disabled={
                saveDisabled || isSubmitting || isSaved || items.length === 0 || clientMissing
              }
            >
              {isSubmitting
                ? "Guardando cotización..."
                : isSaved
                  ? "Cotización guardada"
                  : "Guardar cotización"}
            </Button>
            {clientMissing && items.length > 0 && !isSaved ? (
              <ActionHint className="text-center">
                Elegí un cliente para guardar
              </ActionHint>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
