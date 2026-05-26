import Link from "next/link";

import { QuotationShareActions } from "@/components/cotizacion/quotation-share-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCurrencyAmount,
  formatDateOnly,
  formatDateTime,
} from "@/lib/formatting";
import { getProfile, requireUser } from "@/lib/profile";
import {
  getDraftQuotationEditorHref,
  getQuotations,
  isDraftQuotationStatus,
} from "@/lib/quotations";

function formatStatusLabel(value: string | null) {
  const normalizedValue = value?.trim().toLowerCase();

  switch (normalizedValue) {
    case "draft":
      return "Borrador";
    case "pending":
      return "Pendiente";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "expired":
      return "Vencida";
    default:
      return normalizedValue
        ? normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1)
        : "Sin estado";
  }
}

function getStatusBadgeClassName(value: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "accepted":
      return "border-primary/40 bg-primary/10 text-primary";
    case "rejected":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "pending":
      return "border-token bg-surface-2 text-foreground";
    case "expired":
      return "border-token bg-background text-muted-foreground";
    default:
      return "border-token bg-background text-foreground";
  }
}

export default async function QuotationsPage() {
  const user = await requireUser();
  const [quotations, profile] = await Promise.all([
    getQuotations(user.id),
    getProfile(user.id),
  ]);
  const draftCount = quotations.filter(
    (quotation) => isDraftQuotationStatus(quotation.status),
  ).length;
  const activeStatuses = new Map<string, number>();

  for (const quotation of quotations) {
    const label = formatStatusLabel(quotation.status);
    activeStatuses.set(label, (activeStatuses.get(label) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Cotizaciones
            </span>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight">
                Historial de cotizaciones
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Consulta tus borradores y futuras etapas de seguimiento desde una
                lista clara, con totales y fechas reales.
              </p>
            </div>
          </div>

          <Button
            asChild
            className="bg-accent-token text-black hover:bg-accent-hover"
          >
            <Link href="/cotizaciones/nueva">Nueva cotizacion</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader className="space-y-1">
            <CardDescription>Total cargadas</CardDescription>
            <CardTitle className="text-3xl">{quotations.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader className="space-y-1">
            <CardDescription>Borradores activos</CardDescription>
            <CardTitle className="text-3xl">{draftCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader className="space-y-2">
            <CardDescription>Estados presentes</CardDescription>
            <div className="flex flex-wrap gap-2">
              {activeStatuses.size === 0 ? (
                <span className="rounded-full border border-token/80 px-3 py-1 text-xs text-muted-foreground">
                  Sin movimientos
                </span>
              ) : (
                Array.from(activeStatuses.entries()).map(([label, count]) => (
                  <span
                    key={label}
                    className="rounded-full border border-token/80 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {label}: {count}
                  </span>
                ))
              )}
            </div>
          </CardHeader>
        </Card>
      </section>

      {quotations.length === 0 ? (
        <Card className="border-dashed border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              Todavia no creaste cotizaciones
            </CardTitle>
            <CardDescription>
              Empeza con tu primera cotizacion para ver el historial completo
              desde esta pantalla.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="outline"
              className="border-token bg-transparent"
            >
              <Link href="/cotizaciones/nueva">Ir a nueva cotizacion</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4">
          {quotations.map((quotation) => {
            const reopenDraftHref = getDraftQuotationEditorHref(quotation);
            const canShareQuotation =
              isDraftQuotationStatus(quotation.status) || quotation.status === "pending";

            return (
              <Card key={quotation.id} className="border-token bg-surface shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{quotation.number}</CardTitle>
                      <CardDescription>
                        {quotation.client_name?.trim() || "Cliente sin asignar"}
                      </CardDescription>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadgeClassName(quotation.status)}`}
                    >
                      {formatStatusLabel(quotation.status)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-base font-semibold text-foreground">
                      {formatCurrencyAmount(
                        quotation.subtotal,
                        profile?.currency ?? null,
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total estimado</p>
                    <p className="text-lg font-semibold">
                      {formatCurrencyAmount(
                        quotation.total,
                        profile?.currency ?? null,
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Impuesto</p>
                    <p className="text-sm font-medium text-foreground">
                      {quotation.tax_rate ?? 0}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Valida hasta</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatDateOnly(quotation.valid_until)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Creada</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatDateTime(quotation.created_at)}
                    </p>
                  </div>
                  <div className="md:col-span-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {quotation.notes?.trim() ||
                        "Sin notas adicionales para esta cotizacion."}
                    </p>
                  </div>
                  {canShareQuotation ? (
                    <div className="md:col-span-4">
                      <QuotationShareActions
                        quotationId={quotation.id}
                        quotationNumber={quotation.number}
                        initialPdfGeneratedAt={quotation.pdf_generated_at}
                        initialShareToken={quotation.share_token}
                        initialSentAt={quotation.sent_at}
                        initialStatus={quotation.status}
                      />
                    </div>
                  ) : null}
                  {reopenDraftHref ? (
                    <div className="md:col-span-4">
                      <Button
                        asChild
                        variant="outline"
                        className="border-token bg-background text-foreground"
                      >
                        <Link href={reopenDraftHref}>Reabrir borrador</Link>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
