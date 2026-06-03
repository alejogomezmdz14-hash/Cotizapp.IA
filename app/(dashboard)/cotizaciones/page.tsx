import type { Metadata } from "next";
import Link from "next/link";

import { QuotationsList } from "@/components/cotizacion/quotations-list";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/profile";
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

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:items-end">
          <div className="space-y-5">
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Tus cotizaciones
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Revisá tus borradores y cotizaciones enviadas en un solo lugar.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-12">
                <Link href="/cotizaciones/nueva">Nueva cotización</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-md border border-token bg-background/80 p-4 shadow-none">
              <p className="text-sm font-medium text-muted-foreground">Total cargadas</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {quotations.length}
              </p>
            </div>
            <div className="rounded-md border border-token bg-background/60 p-4 shadow-none">
              <p className="text-sm font-medium text-muted-foreground">Sin enviar</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{draftCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5">
          <h3 className="text-xl font-semibold tracking-tight">Tus cotizaciones</h3>
        </div>

        <QuotationsList
          quotations={quotations}
          currency={profile?.currency ?? null}
        />
      </section>
    </div>
  );
}
