import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, Layers3, ReceiptText } from "lucide-react";

import { QuotationsList } from "@/components/cotizacion/quotations-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProfile, requireUser } from "@/lib/profile";
import { formatQuotationStatusLabel } from "@/lib/quotation-status";
import { getQuotations, isDraftQuotationStatus } from "@/lib/quotations";

export const metadata: Metadata = {
  title: "Cotizaciones | Cotizapp",
};

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
    const label = formatQuotationStatusLabel(quotation.status);
    activeStatuses.set(label, (activeStatuses.get(label) ?? 0) + 1);
  }

  const summaryCardClassName = "!rounded-md !border-token !bg-background/75 !shadow-none";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:items-end">
          <div className="space-y-5">
            <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Cotizaciones
            </span>

            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Tus cotizaciones
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Revisá tus borradores y cotizaciones enviadas en un solo lugar.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/cotizaciones/nueva">Nueva cotización</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-md border border-token bg-background/80 p-4 shadow-none">
              <p className="ui-shell-kicker">
                Total cargadas
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {quotations.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Todas tus cotizaciones, en cualquier estado.
              </p>
            </div>
            <div className="rounded-md border border-token bg-background/60 p-4 shadow-none">
              <p className="ui-shell-kicker">
                Borradores activos
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {draftCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Borradores sin enviar todavía.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="ui-shell-kicker">
              Vista general
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Resumen por estado
            </h3>
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
                Borradores y cotizaciones enviadas en total.
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
                Podés editarlos y enviarlos cuando quieras.
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
                Distintos estados activos en este momento.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="ui-shell-kicker">
              Historial detallado
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Tus cotizaciones recientes
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Filtrá por estado o buscá por cliente. Cambiá entre tarjetas o tabla.
            </p>
          </div>

        </div>

        <QuotationsList
          quotations={quotations}
          currency={profile?.currency ?? null}
        />
      </section>
    </div>
  );
}
