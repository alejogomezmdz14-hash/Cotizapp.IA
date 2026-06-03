"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FileCheck2,
  FileText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";

import {
  createDraftQuotationAction,
  updateDraftQuotationAction,
} from "@/app/actions/quotations";
import type { QuotationEditorInitialState } from "@/lib/quotation-editor";
import {
  getDefaultQuotationValidityDate,
  isQuotationPastValidity,
} from "@/lib/quotation-expiry";
import { ClientPicker } from "@/components/clientes/client-picker";
import { QuotationAttachments } from "@/components/cotizacion/quotation-attachments";
import { QuotationItemsEditor, type QuotationEditorItem } from "@/components/cotizacion/quotation-items-editor";
import { QuotationShareActions } from "@/components/cotizacion/quotation-share-actions";
import { QuotationSummary } from "@/components/cotizacion/quotation-summary";
import { QuotationWizard } from "@/components/cotizacion/quotation-wizard";
import { useCotizacionStore } from "@/store/cotizacion-store";
import { InvoiceItemsReview } from "@/components/uploads/invoice-items-review";
import { InvoiceDropzone } from "@/components/uploads/invoice-dropzone";
import { buildNewQuotationPageHref } from "@/lib/invoice-scan/persistence";
import { mergeHydratedInvoiceScanReview } from "@/lib/invoice-scan/review-state";
import { markUnsavedDraft } from "@/lib/pending-tasks";
import { getDefaultQuotationClientId } from "@/lib/quotation-client-selection";
import { calculateQuotationTotals } from "@/lib/quotation-calculations";
import { formatCurrencyAmount } from "@/lib/formatting";
import {
  getQuotationValidityBounds,
  getQuotationValidityPresetDate,
} from "@/lib/quotation-validity";
import { isDraftQuotationStatus } from "@/lib/quotation-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import type {
  CatalogItem,
  Client,
  HydratedQuotationAttachment,
  HydratedInvoiceScanReview,
  InvoiceScanItemDraft,
} from "@/types";

type QuotationFormProps = {
  clients: Client[];
  catalogItems: CatalogItem[];
  currency: string | null;
  initialDraft?: SavedDraftState | null;
  initialEditorState?: QuotationEditorInitialState | null;
  initialAttachments?: HydratedQuotationAttachment[];
  initialInvoiceScan?: HydratedInvoiceScanReview | null;
};

type SavedDraftState = {
  quotationId: string;
  number: string;
  status?: string | null;
  pdfGeneratedAt?: string | null;
  shareToken?: string | null;
  sentAt?: string | null;
};

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const sectionCardClassName = "shell-panel overflow-hidden shadow-none";
const validityPresets = [30, 60, 90] as const;
function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo guardar la cotización.";
}

function createEmptyItem(id: number): QuotationEditorItem {
  return {
    id: `item-${id}`,
    source: "manual",
    catalogItemId: null,
    name: "",
    description: "",
    quantity: 1,
    unit: "unidad",
    unitPrice: 0,
  };
}

function createCatalogItemDraft(id: number, item: CatalogItem): QuotationEditorItem {
  return {
    id: `item-${id}`,
    source: "catalog",
    catalogItemId: item.id,
    name: item.name,
    description: item.description ?? "",
    quantity: 1,
    unit: item.unit,
    unitPrice: item.price,
  };
}

function createInvoiceItemDraft(
  id: number,
  item: InvoiceScanItemDraft,
): QuotationEditorItem {
  return {
    id: `item-${id}`,
    source: "invoice",
    catalogItemId: null,
    name: item.name,
    description: item.description ?? "",
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
  };
}

export function QuotationForm({
  clients,
  catalogItems,
  currency,
  initialDraft = null,
  initialEditorState = null,
  initialAttachments = [],
  initialInvoiceScan = null,
}: QuotationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const draft = useCotizacionStore((state) => state.draft);
  const setClientMode = useCotizacionStore((state) => state.setClientMode);
  const setSelectedClientId = useCotizacionStore((state) => state.setSelectedClientId);
  const setInlineClient = useCotizacionStore((state) => state.setInlineClient);
  const addItem = useCotizacionStore((state) => state.addItem);
  const removeItem = useCotizacionStore((state) => state.removeItem);
  const updateItem = useCotizacionStore((state) => state.updateItem);
  const setTaxRate = useCotizacionStore((state) => state.setTaxRate);
  const setValidUntil = useCotizacionStore((state) => state.setValidUntil);
  const setNotes = useCotizacionStore((state) => state.setNotes);
  const allocNextItemId = useCotizacionStore((state) => state.allocNextItemId);
  const resetDraft = useCotizacionStore((state) => state.resetDraft);
  const hydrateFromEditor = useCotizacionStore((state) => state.hydrateFromEditor);
  const showDraftBannerIfNeeded = useCotizacionStore((state) => state.showDraftBannerIfNeeded);
  const dismissDraftBanner = useCotizacionStore((state) => state.dismissDraftBanner);
  const hasDraftContent = useCotizacionStore((state) => state.hasDraftContent);

  const clientMode = draft.clientMode;
  const selectedClientId = draft.selectedClientId;
  const inlineClient = draft.inlineClient;
  const items = draft.items;
  const taxRate = draft.taxRate;
  const validUntil = draft.validUntil;
  const notes = draft.notes;
  const draftBannerVisible = draft.draftBannerVisible;
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDraft, setSavedDraft] = useState<SavedDraftState | null>(initialDraft);
  const [invoiceScanReview, setInvoiceScanReview] =
    useState<HydratedInvoiceScanReview | null>(initialInvoiceScan);
  const [scanSectionExpanded, setScanSectionExpanded] = useState(
    Boolean(initialInvoiceScan),
  );
  const currentDraft = savedDraft ?? initialDraft;
  const attachmentsReadOnly = currentDraft?.status
    ? !isDraftQuotationStatus(currentDraft.status)
    : false;

  useEffect(() => {
    setInvoiceScanReview((currentValue) =>
      mergeHydratedInvoiceScanReview(currentValue, initialInvoiceScan),
    );
  }, [initialInvoiceScan]);

  useEffect(() => {
    if (initialDraft) {
      setSavedDraft(initialDraft);
      return;
    }

    setSavedDraft(null);
    setError(null);
    setIsSubmitting(false);
    setInvoiceScanReview(initialInvoiceScan);
    setScanSectionExpanded(Boolean(initialInvoiceScan));

    if (initialEditorState) {
      return;
    }

    if (!hasDraftContent()) {
      setClientMode(clients.length > 0 ? "existing" : "inline");
      setSelectedClientId(getDefaultQuotationClientId(clients));
    } else {
      showDraftBannerIfNeeded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, initialDraft?.quotationId]);

  useEffect(() => {
    if (!initialEditorState) {
      return;
    }

    setSavedDraft({
      quotationId: initialEditorState.quotationId,
      number: initialEditorState.number,
      status: initialEditorState.status,
      pdfGeneratedAt: initialEditorState.pdfGeneratedAt,
      shareToken: initialEditorState.shareToken,
      sentAt: initialEditorState.sentAt,
    });
    hydrateFromEditor({
      clientId: initialEditorState.clientId,
      clientName: initialEditorState.clientName,
      items: initialEditorState.items,
      taxRate: initialEditorState.taxRate,
      validUntil:
        initialEditorState.validUntil || getDefaultQuotationValidityDate(),
      notes: initialEditorState.notes,
    });
    setError(null);
    markUnsavedDraft(false);
  }, [hydrateFromEditor, initialEditorState]);

  const hasUnsavedChanges = useMemo(() => {
    if (savedDraft) {
      return false;
    }

    const hasClientData =
      clientMode === "inline"
        ? Boolean(
            inlineClient.name.trim() ||
              inlineClient.email.trim() ||
              inlineClient.phone.trim() ||
              inlineClient.address.trim(),
          )
        : Boolean(selectedClientId);

    return (
      hasClientData ||
      items.length > 0 ||
      taxRate > 0 ||
      Boolean(validUntil.trim()) ||
      Boolean(notes.trim()) ||
      Boolean(invoiceScanReview)
    );
  }, [
    clientMode,
    inlineClient,
    invoiceScanReview,
    items.length,
    notes,
    savedDraft,
    selectedClientId,
    taxRate,
    validUntil,
  ]);

  useEffect(() => {
    markUnsavedDraft(hasUnsavedChanges && !savedDraft);
  }, [hasUnsavedChanges, savedDraft]);

  function replaceCurrentEditorUrl(scanId: string | null) {
    router.replace(
      buildNewQuotationPageHref({
        quotationId: savedDraft?.quotationId ?? initialDraft?.quotationId ?? null,
        scanId,
      }),
      {
        scroll: false,
      },
    );
  }

  const isEditingDraft = Boolean(initialEditorState);
  const isFormLocked = isSubmitting || (Boolean(savedDraft) && !isEditingDraft);
  const validityBounds = useMemo(() => getQuotationValidityBounds(), []);
  const isValidityInPast = Boolean(validUntil.trim()) && isQuotationPastValidity(validUntil);
  const summaryTotals = useMemo(
    () => calculateQuotationTotals(items, taxRate),
    [items, taxRate],
  );
  const canSaveQuotation =
    items.length > 0 &&
    !isValidityInPast &&
    !isFormLocked &&
    !(Boolean(savedDraft) && !isEditingDraft);
  const selectedExistingClientName =
    clients.find((client) => client.id === selectedClientId)?.name ?? null;
  const clientSnapshotLabel =
    clientMode === "existing"
      ? selectedExistingClientName ?? (clients.length > 0 ? "Selecciona un cliente" : "Sin clientes")
      : inlineClient.name.trim() || "Nuevo cliente inline";
  const invoiceSnapshotLabel =
    invoiceScanReview?.result
      ? `${invoiceScanReview.result.items.length} item(s) detectado(s)`
      : invoiceScanReview?.status === "processing"
        ? "Escaneo en curso"
        : invoiceScanReview?.status === "failed"
          ? "Escaneo fallido"
          : invoiceScanReview?.fileName
            ? "Factura cargada"
            : "Sin factura";

  const itemsPayload = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          catalogItemId: item.catalogItemId,
          name: item.name,
          description: item.description.trim(),
          quantity: item.quantity,
          unit: item.unit.trim(),
          unitPrice: item.unitPrice,
        })),
      ),
    [items],
  );

  const clientPayload = useMemo(
    () =>
      JSON.stringify({
        name: inlineClient.name,
        email: inlineClient.email,
        phone: inlineClient.phone,
        address: inlineClient.address,
      }),
    [inlineClient],
  );

  function activateExistingClientMode() {
    if (isFormLocked) {
      return;
    }

    setError(null);
    setClientMode("existing");
    setSelectedClientId(selectedClientId ?? getDefaultQuotationClientId(clients));
  }

  function activateInlineClientMode() {
    if (isFormLocked) {
      return;
    }

    setError(null);
    setSelectedClientId(null);
    setClientMode("inline");
  }

  function handleAddManualItem() {
    const nextItemId = allocNextItemId();
    addItem(createEmptyItem(nextItemId));
  }

  function handleAddCatalogItem(item: CatalogItem) {
    const nextItemId = allocNextItemId();
    addItem(createCatalogItemDraft(nextItemId, item));
  }

  function handleUpdateItem(
    itemId: string,
    updates: Partial<QuotationEditorItem>,
  ) {
    updateItem(itemId, updates);
  }

  function handleRemoveItem(itemId: string) {
    removeItem(itemId);
  }

  function handleInvoiceScanComplete({
    scanId,
    fileName,
    result,
  }: {
    scanId: string;
    fileName: string;
    result: HydratedInvoiceScanReview["result"];
  }) {
    setInvoiceScanReview({
      scanId,
      fileName,
      status: "completed",
      failureMessage: null,
      result,
    });
    setError(null);
    replaceCurrentEditorUrl(scanId);
  }

  function handleInvoiceScanPersisted({
    scanId,
    fileName,
    status,
    failureMessage,
  }: {
    scanId: string;
    fileName: string;
    status: "uploaded" | "processing" | "failed" | "completed";
    failureMessage: string | null;
  }) {
    setInvoiceScanReview((currentValue) =>
      currentValue?.scanId === scanId && currentValue.result
        ? {
            ...currentValue,
            fileName,
            status,
            failureMessage,
          }
        : {
            scanId,
            fileName,
            status,
            failureMessage,
            result: null,
          },
    );
    replaceCurrentEditorUrl(scanId);
  }

  function handleClearInvoiceScan() {
    setInvoiceScanReview(null);
    setError(null);
    replaceCurrentEditorUrl(null);
  }

  function handleShareStateChange(nextState: {
    pdfGeneratedAt: string | null;
    shareToken: string | null;
    sentAt: string | null;
    status: string | null;
  }) {
    setSavedDraft((currentValue) => {
      const draftState = currentValue ?? initialDraft;

      if (!draftState) {
        return currentValue;
      }

      return {
        ...draftState,
        pdfGeneratedAt: nextState.pdfGeneratedAt,
        shareToken: nextState.shareToken,
        sentAt: nextState.sentAt,
        status: nextState.status,
      };
    });
  }

  function handleAddInvoiceItems(scannedItems: InvoiceScanItemDraft[]) {
    if (scannedItems.length === 0) {
      return;
    }

    scannedItems.forEach((item) => {
      const nextItemId = allocNextItemId();
      addItem(createInvoiceItemDraft(nextItemId, item));
    });
    setError(null);
  }

  async function submitQuotation() {

    if (savedDraft && !isEditingDraft) {
      return;
    }

    if (clientMode === "existing" && !selectedClientId) {
      setError(
        "Selecciona un cliente existente o crea uno nuevo dentro de la cotización.",
      );
      return;
    }

    if (clientMode === "inline" && !inlineClient.name.trim()) {
      setError("Completa los datos del cliente antes de guardar la cotización.");
      return;
    }

    if (!canSaveQuotation) {
      if (items.length === 0) {
        setError("Agrega al menos un ítem a la cotización antes de guardarla.");
      } else if (isValidityInPast) {
        setError("La fecha de validez no puede estar en el pasado.");
      }
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (isEditingDraft && initialEditorState?.quotationId) {
        formData.set("quotation_id", initialEditorState.quotationId);
      }
      formData.set("client_mode", clientMode);
      formData.set(
        "client_id",
        clientMode === "existing" ? selectedClientId ?? "" : "",
      );
      formData.set("client_payload", clientMode === "inline" ? clientPayload : "");
      formData.set("items_payload", itemsPayload);
      formData.set("tax_rate", String(taxRate));
      formData.set("valid_until", validUntil);
      formData.set("notes", notes);

      const result = isEditingDraft
        ? await updateDraftQuotationAction(formData)
        : await createDraftQuotationAction(formData);
      setSavedDraft(result);
      markUnsavedDraft(false);
      resetDraft({ clientMode: clients.length > 0 ? "existing" : "inline" });
      toast({
        title: isEditingDraft ? "Cotización actualizada" : "Cotización guardada",
        description: isEditingDraft
          ? `El borrador ${result.number} quedó actualizado.`
          : `El borrador ${result.number} ya está listo para seguir con PDF y WhatsApp.`,
      });
      router.replace(
        buildNewQuotationPageHref({
          quotationId: result.quotationId,
        }),
      );
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuotation();
  }

  if (initialDraft && !initialEditorState) {
    return (
      <div className="space-y-5 lg:space-y-6">
        <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Borrador creado
              </span>
              <div className="space-y-2">
                <h3 className="text-3xl font-semibold tracking-tight">
                  {currentDraft?.number}
                </h3>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  {attachmentsReadOnly
                    ? "Esta cotización ya fue compartida. Desde aquí puedes revisar el PDF, reenviarla por WhatsApp y consultar sus adjuntos en solo lectura."
                    : "Este borrador ya existe. Desde esta vista puedes completar adjuntos, regenerar el PDF o volver al historial sin duplicar información."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="bg-background/75"
                onClick={() => {
                  resetDraft({
                    clientMode: clients.length > 0 ? "existing" : "inline",
                  });
                  router.replace("/cotizaciones/nueva");
                }}
              >
                Nueva cotización
              </Button>
              <Button
                type="button"
                variant="outline"
                className="bg-background/75"
                onClick={() => router.push("/cotizaciones")}
              >
                Volver a cotizaciones
              </Button>
            </div>
          </div>
        </section>

        <QuotationShareActions
          quotationId={currentDraft?.quotationId ?? initialDraft.quotationId}
          quotationNumber={currentDraft?.number ?? initialDraft.number}
          initialPdfGeneratedAt={
            currentDraft?.pdfGeneratedAt ?? initialDraft.pdfGeneratedAt ?? null
          }
          initialShareToken={
            currentDraft?.shareToken ?? initialDraft.shareToken ?? null
          }
          initialSentAt={currentDraft?.sentAt ?? initialDraft.sentAt ?? null}
          initialStatus={currentDraft?.status ?? initialDraft.status ?? null}
          onStateChange={handleShareStateChange}
        />

        <QuotationAttachments
          quotationId={currentDraft?.quotationId ?? null}
          initialAttachments={initialAttachments}
          readOnly={attachmentsReadOnly}
        />
      </div>
    );
  }

  return (
    <>
      <div className="xl:hidden">
        {draftBannerVisible ? (
          <div className="mb-4 rounded-[1.5rem] border border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.08)] px-4 py-4 text-sm">
            <p className="font-medium text-foreground">
              Tenés una cotización sin guardar. ¿Querés continuar donde lo dejaste?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" className="min-h-12" onClick={dismissDraftBanner}>
                Continuar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 bg-background/75"
                onClick={() => {
                  resetDraft({
                    clientMode: clients.length > 0 ? "existing" : "inline",
                  });
                  setSelectedClientId(getDefaultQuotationClientId(clients));
                }}
              >
                Empezar de nuevo
              </Button>
            </div>
          </div>
        ) : null}

        <QuotationWizard
          clients={clients}
          catalogItems={catalogItems}
          currency={currency}
          disabled={isFormLocked}
          isSubmitting={isSubmitting}
          canSave={canSaveQuotation}
          saveDisabled={!canSaveQuotation}
          onSubmit={() => {
            void submitQuotation();
          }}
        />
      </div>

    <form className="relative hidden space-y-5 pb-24 xl:block lg:space-y-6 lg:pb-0" onSubmit={handleSubmit}>
      <div className="fixed inset-x-0 top-0 z-30 border-b border-token/80 bg-background/95 px-4 py-3 backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Total estimado
            </p>
            <p className="text-lg font-semibold text-foreground">
              {formatCurrencyAmount(summaryTotals.total, currency)}
            </p>
          </div>
          <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            {items.length} ítem{items.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div className="h-14 xl:hidden" aria-hidden />
      {isEditingDraft ? (
        <input
          type="hidden"
          name="quotation_id"
          value={initialEditorState?.quotationId ?? ""}
        />
      ) : null}
      <input type="hidden" name="client_mode" value={clientMode} />
      <input
        type="hidden"
        name="client_id"
        value={clientMode === "existing" ? selectedClientId ?? "" : ""}
      />
      <input
        type="hidden"
        name="client_payload"
        value={clientMode === "inline" ? clientPayload : ""}
      />
      <input type="hidden" name="items_payload" value={itemsPayload} />

      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {savedDraft ? (
        <div className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-300">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p>
              El borrador <span className="font-semibold">{savedDraft.number}</span> ya
              fue creado. Los datos quedaron bloqueados para evitar duplicados y ya
              puedes seguir con adjuntos y acciones de salida.
            </p>
            <Button
              type="button"
              variant="outline"
              className="bg-background/75"
              onClick={() => router.push("/cotizaciones")}
            >
              Ir a cotizaciones
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.78fr)] xl:items-start">
        <div className="space-y-5 lg:space-y-6">
          <div id="paso-cliente" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Users2 className="h-3.5 w-3.5 text-accent-token" />
                Cliente
            </div>
            <Card className={sectionCardClassName}>
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">Datos del cliente</CardTitle>
                    <CardDescription className="leading-6">
                      Elegí un cliente ya guardado, o cargá uno nuevo sin salir de
                      esta pantalla.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={clientMode === "existing" ? "default" : "outline"}
                      className={clientMode === "existing" ? undefined : "bg-background/75"}
                      onClick={activateExistingClientMode}
                      disabled={isFormLocked || clients.length === 0}
                    >
                      Cliente existente
                    </Button>
                    <Button
                      type="button"
                      variant={clientMode === "inline" ? "default" : "outline"}
                      className={clientMode === "inline" ? undefined : "bg-background/75"}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={activateInlineClientMode}
                      disabled={isFormLocked}
                    >
                      Cargar cliente nuevo acá mismo
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-[1.5rem] border border-token/80 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  El cliente elegido aparece en el resumen de la derecha.
                </div>

                {clientMode === "existing" ? (
                  <ClientPicker
                    clients={clients}
                    selectedClientId={selectedClientId}
                    onSelectClient={(client) => setSelectedClientId(client?.id ?? null)}
                    onCreateClient={activateInlineClientMode}
                    allowClear
                    disabled={isFormLocked}
                    description="Seleccioná un cliente guardado para usar sus datos en esta cotización."
                    emptyMessage="Todavía no hay clientes guardados. Podés cargar uno nuevo acá mismo."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="inline-client-name">Nombre</Label>
                      <Input
                        id="inline-client-name"
                        value={inlineClient.name}
                        onChange={(event) =>
                          setInlineClient({ name: event.target.value })
                        }
                        placeholder="Ej. Constructora Andina"
                        disabled={isFormLocked}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="inline-client-email">Email</Label>
                        <Input
                          id="inline-client-email"
                          type="email"
                          value={inlineClient.email}
                          onChange={(event) =>
                            setInlineClient({ email: event.target.value })
                          }
                          placeholder="cliente@empresa.com"
                          disabled={isFormLocked}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inline-client-phone">Teléfono</Label>
                        <Input
                          id="inline-client-phone"
                          type="tel"
                          minLength={8}
                          value={inlineClient.phone}
                          onChange={(event) =>
                            setInlineClient({ phone: event.target.value })
                          }
                          placeholder="261 555 1234"
                          disabled={isFormLocked}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="inline-client-address">Dirección</Label>
                      <textarea
                        id="inline-client-address"
                        rows={3}
                        value={inlineClient.address}
                        onChange={(event) =>
                          setInlineClient({ address: event.target.value })
                        }
                        placeholder="Dirección o referencia de entrega"
                        disabled={isFormLocked}
                        className={textareaClassName}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div id="paso-items" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-accent-token" />
                Ítems
            </div>
            <QuotationItemsEditor
              items={items}
              catalogItems={catalogItems}
              currency={currency}
              disabled={isFormLocked}
              onAddManualItem={handleAddManualItem}
              onAddCatalogItem={handleAddCatalogItem}
              onRemoveItem={handleRemoveItem}
              onUpdateItem={handleUpdateItem}
            />
          </div>

          <div id="paso-escaneo" className="space-y-3 scroll-mt-24">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <ReceiptText className="h-3.5 w-3.5 text-accent-token" />
                Notas
              </div>
              {!scanSectionExpanded ? (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-background/75"
                  onClick={() => setScanSectionExpanded(true)}
                  disabled={isFormLocked}
                >
                  Tengo una factura para escanear
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => setScanSectionExpanded(false)}
                  disabled={isFormLocked}
                >
                  Ocultar escaneo
                </Button>
              )}
            </div>

            {scanSectionExpanded ? (
              <>
                <InvoiceDropzone
                  disabled={isFormLocked}
                  persistedScan={invoiceScanReview}
                  onScanPersisted={handleInvoiceScanPersisted}
                  onScanComplete={handleInvoiceScanComplete}
                />

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-accent-token" />
                    Revisión del escaneo
                  </div>
                  <InvoiceItemsReview
                    fileName={invoiceScanReview?.fileName ?? null}
                    result={invoiceScanReview?.result ?? null}
                    disabled={isFormLocked}
                    onAddToQuotation={handleAddInvoiceItems}
                    onClear={handleClearInvoiceScan}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-token/80 bg-background/60 px-4 py-4 text-sm leading-6 text-muted-foreground">
                ¿Tenés una factura o ticket de compra? Sacale una foto y el sistema
                carga los datos solo.
              </div>
            )}
          </div>

          <div id="paso-ajustes" className="space-y-3 scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-accent-token" />
                Ajustes
            </div>
            <Card className={sectionCardClassName}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Resumen</CardTitle>
                <CardDescription className="leading-6">
                  Definí impuesto, validez y notas para esta cotización.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tax-rate">Impuesto (%)</Label>
                    <Input
                      id="tax-rate"
                      name="tax_rate"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={taxRate}
                      onChange={(event) => {
                        const parsedValue = Number.parseFloat(event.target.value);
                        setTaxRate(Number.isFinite(parsedValue) ? parsedValue : 0);
                      }}
                      disabled={isFormLocked}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valid-until">¿Hasta cuándo vale esta cotización?</Label>
                    <Input
                      id="valid-until"
                      name="valid_until"
                      type="date"
                      value={validUntil}
                      onChange={(event) => setValidUntil(event.target.value)}
                      min={validityBounds.minDate}
                      max={validityBounds.maxDate}
                      disabled={isFormLocked}
                    />
                    <div className="flex flex-wrap gap-2">
                      {validityPresets.map((days) => (
                        <Button
                          key={days}
                          type="button"
                          variant="outline"
                          className="min-h-12 bg-background/75 px-6"
                          disabled={isFormLocked}
                          onClick={() => {
                            setValidUntil(getQuotationValidityPresetDate(days));
                            setError(null);
                          }}
                        >
                          {days} días
                        </Button>
                      ))}
                    </div>
                    {isValidityInPast ? (
                      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        La fecha de validez no puede estar en el pasado.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-token/80 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  Acá podés agregar condiciones, tiempos o aclaraciones para el cliente.
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quotation-notes">Notas</Label>
                  <textarea
                    id="quotation-notes"
                    name="notes"
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Condiciones, tiempos de entrega o cualquier observación relevante"
                    disabled={isFormLocked}
                    className={textareaClassName}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <FileCheck2 className="h-3.5 w-3.5 text-accent-token" />
              Fotos y documentos de esta cotización
            </div>
            <QuotationAttachments
              quotationId={currentDraft?.quotationId ?? null}
              initialAttachments={initialAttachments}
              readOnly={attachmentsReadOnly}
            />
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[1.5rem] border border-token bg-background/75 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Cliente
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {clientSnapshotLabel}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-token bg-background/75 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Escanear factura
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {invoiceSnapshotLabel}
              </p>
            </div>
          </div>

          <QuotationSummary
            items={items}
            currency={currency}
            taxRate={taxRate}
            validUntil={validUntil}
            isSubmitting={isSubmitting}
            isSaved={Boolean(savedDraft) && !isEditingDraft}
            saveDisabled={!canSaveQuotation}
            quotationId={currentDraft?.quotationId ?? null}
            draftNumber={currentDraft?.number ?? null}
            pdfGeneratedAt={currentDraft?.pdfGeneratedAt ?? null}
            shareToken={currentDraft?.shareToken ?? null}
            sentAt={currentDraft?.sentAt ?? null}
            shareStatus={currentDraft?.status ?? null}
            onStateChange={handleShareStateChange}
          />
        </div>
      </div>
    </form>
    </>
  );
}
