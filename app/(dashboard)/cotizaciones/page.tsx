import Link from "next/link";

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
import { getQuotations } from "@/lib/quotations";

function formatStatus(value: string | null) {
  if (!value) {
    return "Sin estado";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function QuotationsPage() {
  const user = await requireUser();
  const [quotations, profile] = await Promise.all([
    getQuotations(user.id),
    getProfile(user.id),
  ]);

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
                Revisa tus documentos creados y entra rapido al flujo de nueva
                cotizacion.
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
          {quotations.map((quotation) => (
            <Card key={quotation.id} className="border-token bg-surface shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{quotation.number}</CardTitle>
                    <CardDescription>
                      {quotation.client_name?.trim() || "Cliente sin asignar"}
                    </CardDescription>
                  </div>
                  <span className="w-fit rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {formatStatus(quotation.status)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
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
                <div className="md:col-span-3">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {quotation.notes?.trim() ||
                      "Sin notas adicionales para esta cotizacion."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
