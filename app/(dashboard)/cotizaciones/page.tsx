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
    <div className="space-y-5 lg:space-y-6">
      {/* Solo escritorio. En un celular este bloque eran ~450px de título 3xl,
          un párrafo de relleno, un botón que duplica el "+" de la barra de
          abajo y dos recuadros de estadísticas — todo antes de ver una sola
          cotización. En mobile la lista arranca arriba de todo. */}
      <section className="hidden shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:block">
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

      {/* Sin panel ni padding en mobile: la lista no necesita otra caja
          alrededor, y ese marco le comía ancho a cada fila. */}
      <section className="overflow-hidden lg:shell-panel lg:px-6 lg:py-6">
        <QuotationsList
          quotations={quotations}
          currency={profile?.currency ?? null}
        />
      </section>
    </div>
  );
}
