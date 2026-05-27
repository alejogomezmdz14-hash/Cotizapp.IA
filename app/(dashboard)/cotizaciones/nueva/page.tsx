import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileScan, Layers3, Users2 } from "lucide-react";

import { QuotationForm } from "@/components/cotizacion/quotation-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCatalogItems } from "@/lib/catalog";
import { getClients } from "@/lib/clients";
import { getPersistedInvoiceScanReview } from "@/lib/invoice-scan/load";
import {
  getQuotationAttachments,
  getQuotationDraft,
  loadDraftQuotationHydrationContext,
} from "@/lib/quotations";
import { getProfile, requireUser } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Cotización | Cotizapp",
};

type NewQuotationPageProps = {
  searchParams?: {
    quotationId?: string;
    scanId?: string;
  };
};

export default async function NewQuotationPage({
  searchParams,
}: NewQuotationPageProps) {
  const user = await requireUser();
  const quotationId =
    typeof searchParams?.quotationId === "string"
      ? searchParams.quotationId
      : null;
  const scanId =
    typeof searchParams?.scanId === "string" ? searchParams.scanId : null;
  const [clients, catalogItems, profile, draftHydration, invoiceScanReview] =
    await Promise.all([
      getClients(user.id),
      getCatalogItems(user.id, { orderBy: "name", ascending: true }),
      getProfile(user.id),
      quotationId
        ? loadDraftQuotationHydrationContext({
            getDraftQuotation: () => getQuotationDraft(user.id, quotationId),
            getAttachments: () => getQuotationAttachments(user.id, quotationId),
          })
        : Promise.resolve({
            draftQuotation: null,
            attachments: [],
          }),
      quotationId
        ? Promise.resolve(null)
        : getPersistedInvoiceScanReview(user.id, scanId),
    ]);
  const draftAlreadyCreated = Boolean(draftHydration.draftQuotation);
  const summaryCardClassName =
    "!rounded-[1.75rem] !border-token !bg-background/75 !shadow-[0_20px_45px_-32px_rgba(15,17,23,0.45)]";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:items-end">
          <div className="space-y-5">
            <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Nueva cotización
            </span>

            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {draftAlreadyCreated
                  ? "Revisa el borrador y termina el material de salida"
                  : "Crear cotización borrador con un flujo más claro"}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {draftAlreadyCreated
                  ? "El contenido principal ya está bloqueado, pero sigues teniendo a mano adjuntos, PDF y acciones de compartir desde una superficie más ordenada."
                  : "Elige o crea un cliente, suma ítems manuales, del catálogo o desde factura escaneada y revisa el total antes de guardar."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {["Cliente", "Factura", "Items", "Resumen"].map((step) => (
                <span
                  key={step}
                  className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {step}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="outline" className="bg-background/75">
                <Link href="/cotizaciones">Ver historial</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <Card className={summaryCardClassName}>
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-2xl border border-token bg-background/80 p-3">
                    <Users2 className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <CardDescription>Clientes disponibles</CardDescription>
                  <CardTitle className="text-4xl">{clients.length}</CardTitle>
                </div>
              </CardHeader>
            </Card>

            <Card className={summaryCardClassName}>
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-2xl border border-token bg-background/80 p-3">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <CardDescription>Ítems de catálogo</CardDescription>
                  <CardTitle className="text-4xl">{catalogItems.length}</CardTitle>
                </div>
              </CardHeader>
            </Card>

            <Card className={summaryCardClassName}>
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-2xl border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.12)] p-3 text-accent-token">
                    <FileScan className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <CardDescription>Escaneo listo</CardDescription>
                  <CardTitle className="text-4xl">
                    {invoiceScanReview?.result ? "Sí" : "No"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-6 text-muted-foreground">
                  {invoiceScanReview?.result
                    ? "Hay una factura cargada para revisar y decidir destino."
                    : "Puedes empezar manualmente o subir una factura para precargar conceptos."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <QuotationForm
        clients={clients}
        catalogItems={catalogItems}
        currency={profile?.currency ?? null}
        initialDraft={
          draftHydration.draftQuotation
            ? {
                quotationId: draftHydration.draftQuotation.id,
                number: draftHydration.draftQuotation.number,
                status: draftHydration.draftQuotation.status,
                pdfGeneratedAt: draftHydration.draftQuotation.pdf_generated_at,
                shareToken: draftHydration.draftQuotation.share_token,
                sentAt: draftHydration.draftQuotation.sent_at,
              }
            : null
        }
        initialAttachments={draftHydration.attachments}
        initialInvoiceScan={invoiceScanReview}
      />
    </div>
  );
}
