import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { QuotationMoreMenu } from "@/components/cotizacion/quotation-more-menu";
import { QuotationPaidToggle } from "@/components/cotizacion/quotation-paid-toggle";
import { QuotationShareActions } from "@/components/cotizacion/quotation-share-actions";
import { QuotationSignaturePanel } from "@/components/cotizacion/quotation-signature-panel";
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
import { formatDisplayName } from "@/lib/entity-normalization";
import { getProfile, requireUser } from "@/lib/profile";
import { shouldDisplayQuotationAsExpired } from "@/lib/quotation-expiry";
import { getQuotationSignaturePreviewUrl } from "@/lib/quotation-signatures";
import {
  buildQuotationStatusHistory,
  formatQuotationStatusHistoryLine,
} from "@/lib/quotation-status-history";
import { sanitizeQuotationValidityDate } from "@/lib/quotation-validity";
import {
  getDraftQuotationEditorHref,
  getHydratedQuotation,
  isDraftQuotationStatus,
} from "@/lib/quotations";

export const metadata: Metadata = {
  title: "Detalle de cotización | Cotizapp",
};

function formatStatusLabel(value: string | null) {
  const normalizedValue = value?.trim().toLowerCase();

  switch (normalizedValue) {
    case "draft":
      return "Borrador";
    case "pending":
      return "Enviada";
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

type QuotationDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotationDetailPage({
  params,
}: QuotationDetailPageProps) {
  const { id } = await params;
  const user = await requireUser();
  const [hydrated, profile] = await Promise.all([
    getHydratedQuotation(user.id, id),
    getProfile(user.id),
  ]);

  if (!hydrated) {
    notFound();
  }

  const quotation = hydrated.quotation;
  const signaturePreviewUrl = await getQuotationSignaturePreviewUrl(
    quotation.signature_url,
  );
  const reopenDraftHref = getDraftQuotationEditorHref(quotation);
  const canEditDraft = Boolean(reopenDraftHref);
  const isExpired = shouldDisplayQuotationAsExpired(
    quotation.valid_until,
    quotation.status,
  );
  const statusHistoryLine = formatQuotationStatusHistoryLine(
    buildQuotationStatusHistory({
      status: quotation.status,
      created_at: quotation.created_at ?? new Date().toISOString(),
      sent_at: quotation.sent_at,
      accepted_at: quotation.accepted_at,
      rejected_at: quotation.rejected_at,
    }),
  );
  const canShareQuotation =
    isDraftQuotationStatus(quotation.status) || quotation.status === "pending";
  const cardClassName =
    "!rounded-[1.75rem] !border-token !bg-background/75 !shadow-[0_20px_45px_-32px_rgba(15,17,23,0.45)]";

  return (
    <div className="space-y-6 pb-20">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm" className="w-fit px-0">
            <Link href="/cotizaciones">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a cotizaciones
            </Link>
          </Button>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Cotizaciones / Detalle
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {quotation.number}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadgeClassName(quotation.status)}`}
            >
              {formatStatusLabel(quotation.status)}
            </span>
            {isExpired ? (
              <span className="w-fit rounded-full border border-destructive/50 bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
                Vencida
              </span>
            ) : null}
            {quotation.paid_at ? (
              <span className="w-fit rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Pagada
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{statusHistoryLine}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEditDraft && reopenDraftHref ? (
            <Button asChild>
              <Link href={reopenDraftHref}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          ) : null}
          <QuotationMoreMenu
            quotationId={quotation.id}
            quotationNumber={quotation.number}
            initialStatus={quotation.status}
            paidAt={quotation.paid_at ?? null}
            reopenHref={reopenDraftHref}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className={cardClassName}>
            <CardHeader>
              <CardTitle className="text-xl">
                {formatDisplayName(
                  hydrated.customer.name ?? quotation.client_name,
                ) || "Cliente sin asignar"}
              </CardTitle>
              <CardDescription>
                {quotation.notes?.trim() ||
                  "Sin notas adicionales para esta cotización."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-token/80 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Subtotal
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatCurrencyAmount(
                      quotation.subtotal,
                      profile?.currency ?? null,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatCurrencyAmount(
                      quotation.total,
                      profile?.currency ?? null,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-token/80 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Impuesto
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {quotation.tax_rate ?? 0}%
                  </p>
                </div>
                <div className="rounded-2xl border border-token/80 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Válida hasta
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {formatDateOnly(
                      sanitizeQuotationValidityDate(quotation.valid_until),
                    )}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Creada el {formatDateTime(quotation.created_at)}
              </p>

              {canShareQuotation ? (
                <QuotationShareActions
                  quotationId={quotation.id}
                  quotationNumber={quotation.number}
                  initialPdfGeneratedAt={quotation.pdf_generated_at}
                  initialShareToken={quotation.share_token}
                  initialSentAt={quotation.sent_at}
                  initialStatus={quotation.status}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card className={cardClassName}>
            <CardHeader>
              <CardTitle className="text-lg">Ítems</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hydrated.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta cotización no tiene ítems cargados.
                </p>
              ) : (
                hydrated.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-2xl border border-token/80 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatCurrencyAmount(item.total, profile?.currency ?? null)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <QuotationSignaturePanel
            quotationId={quotation.id}
            currentSignaturePreviewUrl={signaturePreviewUrl}
          />
        </div>

        <aside className="space-y-4">
          <QuotationPaidToggle
            quotationId={quotation.id}
            initialPaidAt={quotation.paid_at ?? null}
          />
        </aside>
      </div>
    </div>
  );
}
