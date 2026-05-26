import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { calculateQuotationTotals } from "@/lib/quotation-calculations";
import { formatCurrencyAmount, formatDateOnly } from "@/lib/formatting";

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
  draftNumber?: string | null;
};

export function QuotationSummary({
  items,
  currency,
  taxRate,
  validUntil,
  isSubmitting = false,
  isSaved = false,
  draftNumber = null,
}: QuotationSummaryProps) {
  const totals = calculateQuotationTotals(items, taxRate);

  return (
    <Card className="border-token bg-surface shadow-sm">
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle className="text-xl">Resumen del borrador</CardTitle>
          <CardDescription>
            Los calculos se actualizan en tiempo real antes de guardar la
            cotizacion.
          </CardDescription>
        </div>
        <div className="rounded-lg border border-token/80 bg-background/60 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Items cargados
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {items.length}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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

        <Separator className="bg-border/70" />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Total estimado</p>
            <p className="text-2xl font-semibold text-foreground">
              {formatCurrencyAmount(totals.total, currency)}
            </p>
          </div>
          <span className="rounded-full border border-token/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Borrador
          </span>
        </div>

        <div className="rounded-lg border border-token/80 bg-background/60 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Validez</p>
          <p className="mt-1 text-muted-foreground">
            {validUntil ? formatDateOnly(validUntil) : "Sin fecha definida"}
          </p>
        </div>

        {draftNumber ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            Borrador guardado con el numero <span className="font-semibold">{draftNumber}</span>.
            Ahora puedes sumar adjuntos antes de salir.
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Al guardar se crea una cotizacion en estado borrador, lista para sumar
            adjuntos y siguientes pasos.
          </p>
        )}

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
