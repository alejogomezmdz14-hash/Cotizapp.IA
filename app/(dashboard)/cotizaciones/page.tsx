import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, FilePlus2, Layers3, ReceiptText } from "lucide-react";

import { QuotationListActions } from "@/components/cotizacion/quotation-list-actions";
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
import { sanitizeQuotationValidityDate } from "@/lib/quotation-validity";
import {
  getDraftQuotationEditorHref,
  getQuotations,
  isDraftQuotationStatus,
} from "@/lib/quotations";

export const metadata: Metadata = {
  title: "Cotizaciones | Cotizapp",
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

  const summaryCardClassName =
    "!rounded-[1.75rem] !border-token !bg-background/75 !shadow-[0_20px_45px_-32px_rgba(15,17,23,0.45)]";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:items-end">
          <div className="space-y-5">
            <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Cotizaciones
            </span>

            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Historial comercial con mejor lectura y acciones más claras
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Sigue tus borradores, revisa cotizaciones pendientes y vuelve al
                flujo correcto sin perder contexto de montos, fechas ni estado.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/cotizaciones/nueva">Nueva cotización</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="bg-background/75">
                <Link href="/dashboard">Volver al panel</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[1.75rem] border border-token bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Total cargadas
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {quotations.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Cotizaciones visibles entre borradores y etapas de seguimiento.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-token bg-background/60 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Borradores activos
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {draftCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Espacios listos para retomar y terminar antes de compartir.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Vista general
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Estado operativo de tus cotizaciones
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Resume rápido el volumen de trabajo y los estados presentes antes de
              entrar a cada cotización.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeStatuses.size === 0 ? (
              <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                Sin movimientos
              </span>
            ) : (
              Array.from(activeStatuses.entries()).map(([label, count]) => (
                <span
                  key={label}
                  className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground"
                >
                  {label}: {count}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className={summaryCardClassName}>
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-2xl border border-token bg-background/80 p-3">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <CardDescription>Total cargadas</CardDescription>
                <CardTitle className="text-4xl">{quotations.length}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Incluye borradores guardados y cotizaciones que ya avanzaron a
                seguimiento.
              </p>
            </CardContent>
          </Card>

          <Card className={summaryCardClassName}>
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-2xl border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.12)] p-3 text-accent-token">
                  <Layers3 className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <CardDescription>Borradores activos</CardDescription>
                <CardTitle className="text-4xl">{draftCount}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Retoma una cotización guardada cuando quieras seguir cargando ítems
                o adjuntos.
              </p>
            </CardContent>
          </Card>

          <Card className={summaryCardClassName}>
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-2xl border border-token bg-background/80 p-3">
                  <Clock3 className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <CardDescription>Estados presentes</CardDescription>
                <CardTitle className="text-4xl">{activeStatuses.size}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                La mezcla actual de estados ayuda a priorizar seguimiento,
                reenvíos o edición.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Historial detallado
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Tus cotizaciones recientes
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Cada tarjeta resume importes, validez y siguientes acciones para que
              no tengas que abrir más pantallas de las necesarias.
            </p>
          </div>

          <Button asChild variant="outline" className="bg-background/75">
            <Link href="/cotizaciones/nueva">
              <FilePlus2 className="mr-2 h-4 w-4" />
              Crear borrador
            </Link>
          </Button>
        </div>

        {quotations.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">
              Todavía no creaste cotizaciones
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Empezá con tu primera cotización para abrir el flujo completo de
              cliente, ítems, resumen y seguimiento desde una sola pantalla.
            </p>
            <div className="mt-5 flex justify-center">
              <Button asChild>
                <Link href="/cotizaciones/nueva">Ir a nueva cotización</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {quotations.map((quotation) => {
              const reopenDraftHref = getDraftQuotationEditorHref(quotation);
              const canShareQuotation =
                isDraftQuotationStatus(quotation.status) ||
                quotation.status === "pending";

              return (
                <Card key={quotation.id} className={summaryCardClassName}>
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            {quotation.number}
                          </span>
                          <span
                            className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadgeClassName(quotation.status)}`}
                          >
                            {formatStatusLabel(quotation.status)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <CardTitle className="text-2xl">
                            {quotation.client_name?.trim() || "Cliente sin asignar"}
                          </CardTitle>
                          <CardDescription className="max-w-2xl leading-6">
                            {quotation.notes?.trim() ||
                              "Sin notas adicionales para esta cotización."}
                          </CardDescription>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-token/80 bg-background/70 px-4 py-3 text-sm">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Creada
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {formatDateTime(quotation.created_at)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-token/80 bg-background/70 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Subtotal
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {formatCurrencyAmount(
                            quotation.subtotal,
                            profile?.currency ?? null,
                          )}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Total estimado
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
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
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {quotation.tax_rate ?? 0}%
                        </p>
                      </div>
                      <div className="rounded-2xl border border-token/80 bg-background/70 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Válida hasta
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {formatDateOnly(
                            sanitizeQuotationValidityDate(quotation.valid_until),
                          )}
                        </p>
                      </div>
                    </div>

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

                    <QuotationListActions
                      quotationId={quotation.id}
                      initialStatus={quotation.status}
                      reopenHref={reopenDraftHref}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
