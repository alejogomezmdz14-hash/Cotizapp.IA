import { QuotationForm } from "@/components/cotizacion/quotation-form";
import { getCatalogItems } from "@/lib/catalog";
import { getClients } from "@/lib/clients";
import { getPersistedInvoiceScanReview } from "@/lib/invoice-scan/load";
import {
  getQuotationAttachments,
  getQuotationDraft,
  loadDraftQuotationHydrationContext,
} from "@/lib/quotations";
import { getProfile, requireUser } from "@/lib/profile";

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

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Nueva cotizacion
        </span>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight">
            Crear cotizacion borrador
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Elige o crea un cliente, agrega items manuales, del catalogo o desde
            una factura escaneada y guarda todo como borrador sin salir de esta
            pantalla.
          </p>
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
