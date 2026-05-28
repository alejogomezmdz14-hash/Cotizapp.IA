import type { Metadata } from "next";

import { QuotationForm } from "@/components/cotizacion/quotation-form";
import { getCatalogItems } from "@/lib/catalog";
import { getClients } from "@/lib/clients";
import { getPersistedInvoiceScanReview } from "@/lib/invoice-scan/load";
import { getQuotationEditorState } from "@/lib/quotation-editor";
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
    edit?: string;
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
  const isEditMode = searchParams?.edit === "1";
  const [clients, catalogItems, profile, draftHydration, editorState, invoiceScanReview] =
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
      quotationId && isEditMode
        ? getQuotationEditorState(user.id, quotationId)
        : Promise.resolve(null),
      quotationId
        ? Promise.resolve(null)
        : getPersistedInvoiceScanReview(user.id, scanId),
    ]);
  const draftAlreadyCreated =
    Boolean(draftHydration.draftQuotation) && !editorState;

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      {draftAlreadyCreated ? null : (
        <section className="space-y-3">
          <h1 className="text-[22px] font-bold leading-tight text-foreground">
            Nueva cotización
          </h1>
          <nav className="flex flex-wrap gap-2 text-sm">
            <a className="rounded-full border border-token px-3 py-1 text-foreground" href="#paso-cliente">
              Cliente
            </a>
            <a className="rounded-full border border-token px-3 py-1 text-foreground" href="#paso-items">
              Items
            </a>
            <a className="rounded-full border border-token px-3 py-1 text-foreground" href="#paso-escaneo">
              Escaneo
            </a>
            <a className="rounded-full border border-token px-3 py-1 text-foreground" href="#paso-ajustes">
              Ajustes
            </a>
          </nav>
        </section>
      )}

      <QuotationForm
        clients={clients}
        catalogItems={catalogItems}
        currency={profile?.currency ?? null}
        initialDraft={
          draftHydration.draftQuotation && !editorState
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
        initialEditorState={editorState}
        initialAttachments={draftHydration.attachments}
        initialInvoiceScan={invoiceScanReview}
      />
    </div>
  );
}
