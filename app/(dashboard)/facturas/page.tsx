import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrencyAmount, formatDateTime } from "@/lib/formatting";
import { getInvoices } from "@/lib/invoices";
import { getProfile, requireUser } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Facturas | Cotizapp",
};

export default async function FacturasPage() {
  const user = await requireUser();
  const [invoices, profile] = await Promise.all([
    getInvoices(user.id),
    getProfile(user.id),
  ]);

  const cardClassName =
    "!rounded-[1.75rem] !border-token !bg-background/75 !shadow-[0_20px_45px_-32px_rgba(15,17,23,0.45)]";

  return (
    <div className="space-y-6 pb-20">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Facturas
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Facturas generadas
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Convertí cotizaciones aceptadas en facturas con numeración FAC.
          </p>
        </div>
        <Button asChild variant="outline" className="bg-background/75">
          <Link href="/cotizaciones">Ir a cotizaciones</Link>
        </Button>
      </section>

      {invoices.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-10 text-center">
          <p className="text-lg font-semibold text-foreground">
            Todavía no generaste facturas
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Abrí una cotización aceptada y usá &quot;Convertir a factura&quot; en el
            menú de acciones.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className={cardClassName}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {invoice.invoice_number}
                  </span>
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    FACTURA
                  </span>
                </div>
                <CardTitle className="text-2xl">
                  {invoice.client_name?.trim() || "Cliente sin asignar"}
                </CardTitle>
                <CardDescription>
                  {invoice.notes?.trim() || "Sin notas adicionales."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatCurrencyAmount(
                      invoice.total,
                      profile?.currency ?? null,
                    )}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Emitida el {formatDateTime(invoice.created_at)}
                  </p>
                </div>
                {invoice.quotation_id ? (
                  <Button asChild variant="outline" className="bg-background/75">
                    <Link href={`/cotizaciones/${invoice.quotation_id}`}>
                      <FileText className="mr-2 h-4 w-4" />
                      Ver cotización origen
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
