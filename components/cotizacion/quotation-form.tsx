"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FileCheck2,
  FileText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";

import { createDraftQuotationAction } from "@/app/actions/quotations";
import { ClientPicker } from "@/components/clientes/client-picker";
import { QuotationAttachments } from "@/components/cotizacion/quotation-attachments";
import { QuotationItemsEditor, type QuotationEditorItem } from "@/components/cotizacion/quotation-items-editor";
import { QuotationShareActions } from "@/components/cotizacion/quotation-share-actions";
import { QuotationSummary } from "@/components/cotizacion/quotation-summary";
import { InvoiceItemsReview } from "@/components/uploads/invoice-items-review";
import { InvoiceDropzone } from "@/components/uploads/invoice-dropzone";
import { buildNewQuotationPageHref } from "@/lib/invoice-scan/persistence";
import { mergeHydratedInvoiceScanReview } from "@/lib/invoice-scan/review-state";
import { getDefaultQuotationClientId } from "@/lib/quotation-client-selection";
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
  initialAttachments?: HydratedQuotationAttachment[];
  initialInvoiceScan?: HydratedInvoiceScanReview | null;
};

type InlineClientState = {
  name: string;
  email: string;
  phone: string;
  address: string;
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo guardar la cotizacion.";
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
  initialAttachments = [],
  initialInvoiceScan = null,
}: QuotationFormProps) {
  const router = useRouter();
  const [clientMode, setClientMode] = useState<"existing" | "inline">(
    clients.length > 0 ? "existing" : "inline",
  );
  const [selectedClientId, setSelectedClientId] = useState<string | null>(() =>
    getDefaultQuotationClientId(clients),
  );
  const [inlineClient, setInlineClient] = useState<InlineClientState>({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [items, setItems] = useState<QuotationEditorItem[]>([]);
  const nextItemIdRef = useRef(1);
  const [taxRate, setTaxRate] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedDraft, setSavedDraft] = useState<SavedDraftState | null>(initialDraft);
  const [invoiceScanReview, setInvoiceScanReview] =
    useState<HydratedInvoiceScanReview | null>(initialInvoiceScan);
  const currentDraft = savedDraft ?? initialDraft;
  const attachmentsReadOnly = currentDraft?.status
    ? !isDraftQuotationStatus(currentDraft.status)
    : false;

  useEffect(() => {
    setInvoiceScanReview((currentValue) =>
      mergeHydratedInvoiceScanReview(currentValue, initialInvoiceScan),
    );
  }, [initialInvoiceScan]);

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

  const isFormLocked = isSubmitting || Boolean(savedDraft);
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

  function handleAddManualItem() {
    const nextItemId = nextItemIdRef.current;
    nextItemIdRef.current += 1;
    setItems((currentItems) => [...currentItems, createEmptyItem(nextItemId)]);
  }

  function handleAddCatalogItem(item: CatalogItem) {
    const nextItemId = nextItemIdRef.current;
    nextItemIdRef.current += 1;
    setItems((currentItems) => [
      ...currentItems,
      createCatalogItemDraft(nextItemId, item),
    ]);
  }

  function handleUpdateItem(
    itemId: string,
    updates: Partial<QuotationEditorItem>,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    );
  }

  function handleRemoveItem(itemId: string) {
    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
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

    setItems((currentItems) => {
      const nextItems = [...currentItems];

      scannedItems.forEach((item) => {
        const nextItemId = nextItemIdRef.current;
        nextItemIdRef.current += 1;
        nextItems.push(createInvoiceItemDraft(nextItemId, item));
      });

      return nextItems;
    });
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savedDraft) {
      return;
    }

    if (clientMode === "existing" && !selectedClientId) {
      setError(
        "Selecciona un cliente existente o crea uno nuevo dentro de la cotizacion.",
      );
      return;
    }

    if (clientMode === "inline" && !inlineClient.name.trim()) {
      setError("Completa los datos del cliente antes de guardar la cotizacion.");
      return;
    }

    if (items.length === 0) {
      setError("Agrega al menos un item a la cotizacion antes de guardarla.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await createDraftQuotationAction(formData);
      setSavedDraft(result);
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

  if (initialDraft) {
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
                    ? "Esta cotizacion ya fue compartida. Desde aqui puedes revisar el PDF, reenviarla por WhatsApp y consultar sus adjuntos en solo lectura."
                    : "Este borrador ya existe. Desde esta vista puedes completar adjuntos, regenerar el PDF o volver al historial sin duplicar informacion."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="bg-background/75"
                onClick={() => router.replace("/cotizaciones/nueva")}
              >
                Nueva cotizacion
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
    <form className="space-y-5 lg:space-y-6" onSubmit={handleSubmit}>
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

      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="space-y-5">
          <div className="space-y-3">
            <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Flujo de trabajo
            </span>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Arma la cotizacion con una vista mas clara de cada etapa
              </h3>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                Define cliente, importa conceptos desde factura o catalogo y revisa
                el resumen antes de guardar el borrador. Todo queda organizado por
                bloques para que el flujo se sienta continuo.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-token bg-background/75 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users2 className="h-4 w-4 text-accent-token" />
                Cliente activo
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {clientSnapshotLabel}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-token bg-background/75 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ReceiptText className="h-4 w-4 text-accent-token" />
                Factura AI
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {invoiceSnapshotLabel}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-token bg-background/75 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-accent-token" />
                Items actuales
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {items.length === 0
                  ? "Todavia no agregaste conceptos al borrador."
                  : `${items.length} item(s) listos para resumir y guardar.`}
              </p>
            </div>
          </div>
        </div>
      </section>

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
          <div className="space-y-3">
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
                      Reutiliza un cliente guardado o cargalo inline para no cortar
                      el flujo del borrador.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={clientMode === "existing" ? "default" : "outline"}
                      className={clientMode === "existing" ? undefined : "bg-background/75"}
                      onClick={() => {
                        setClientMode("existing");
                        setSelectedClientId((currentValue) =>
                          currentValue ?? getDefaultQuotationClientId(clients),
                        );
                      }}
                      disabled={isFormLocked || clients.length === 0}
                    >
                      Cliente existente
                    </Button>
                    <Button
                      type="button"
                      variant={clientMode === "inline" ? "default" : "outline"}
                      className={clientMode === "inline" ? undefined : "bg-background/75"}
                      onClick={() => {
                        setClientMode("inline");
                        setSelectedClientId(null);
                      }}
                      disabled={isFormLocked}
                    >
                      Crear inline
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-[1.5rem] border border-token/80 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  El cliente seleccionado aparece tambien en el resumen lateral para
                  mantener el contexto del borrador mientras cargas items.
                </div>

                {clientMode === "existing" ? (
                  <ClientPicker
                    clients={clients}
                    selectedClientId={selectedClientId}
                    onSelectClient={(client) => setSelectedClientId(client?.id ?? null)}
                    onCreateClient={() => {
                      setClientMode("inline");
                      setSelectedClientId(null);
                    }}
                    allowClear
                    disabled={isFormLocked}
                    description="Selecciona un cliente guardado para reutilizar sus datos en esta cotizacion."
                    emptyMessage="Todavia no hay clientes guardados. Puedes crear uno inline desde esta pantalla."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="inline-client-name">Nombre</Label>
                      <Input
                        id="inline-client-name"
                        value={inlineClient.name}
                        onChange={(event) =>
                          setInlineClient((currentValue) => ({
                            ...currentValue,
                            name: event.target.value,
                          }))
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
                            setInlineClient((currentValue) => ({
                              ...currentValue,
                              email: event.target.value,
                            }))
                          }
                          placeholder="cliente@empresa.com"
                          disabled={isFormLocked}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inline-client-phone">Telefono</Label>
                        <Input
                          id="inline-client-phone"
                          type="tel"
                          value={inlineClient.phone}
                          onChange={(event) =>
                            setInlineClient((currentValue) => ({
                              ...currentValue,
                              phone: event.target.value,
                            }))
                          }
                          placeholder="261 555 1234"
                          disabled={isFormLocked}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="inline-client-address">Direccion</Label>
                      <textarea
                        id="inline-client-address"
                        rows={3}
                        value={inlineClient.address}
                        onChange={(event) =>
                          setInlineClient((currentValue) => ({
                            ...currentValue,
                            address: event.target.value,
                          }))
                        }
                        placeholder="Direccion o referencia de entrega"
                        disabled={isFormLocked}
                        className={textareaClassName}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <ReceiptText className="h-3.5 w-3.5 text-accent-token" />
              Escaneo asistido
            </div>
            <InvoiceDropzone
              disabled={isFormLocked}
              persistedScan={invoiceScanReview}
              onScanPersisted={handleInvoiceScanPersisted}
              onScanComplete={handleInvoiceScanComplete}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent-token" />
              Revision del escaneo
            </div>
            <InvoiceItemsReview
              fileName={invoiceScanReview?.fileName ?? null}
              result={invoiceScanReview?.result ?? null}
              disabled={isFormLocked}
              onAddToQuotation={handleAddInvoiceItems}
              onClear={handleClearInvoiceScan}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-accent-token" />
              Construccion del borrador
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

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-accent-token" />
              Ajustes finales
            </div>
            <Card className={sectionCardClassName}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Ajustes del borrador</CardTitle>
                <CardDescription className="leading-6">
                  Define impuesto, validez y notas internas o visibles para este
                  borrador.
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
                    <Label htmlFor="valid-until">Valida hasta</Label>
                    <Input
                      id="valid-until"
                      name="valid_until"
                      type="date"
                      value={validUntil}
                      onChange={(event) => setValidUntil(event.target.value)}
                      disabled={isFormLocked}
                    />
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-token/80 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  Define aqui condiciones, tiempos o aclaraciones que luego quieras
                  tener visibles al revisar el borrador.
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quotation-notes">Notas</Label>
                  <textarea
                    id="quotation-notes"
                    name="notes"
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Condiciones, tiempos de entrega o cualquier observacion relevante"
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
              Material de respaldo
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
                Factura AI
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
            isSaved={Boolean(currentDraft)}
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
  );
}
