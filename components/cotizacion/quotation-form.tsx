"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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
      <div className="space-y-6">
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Borrador ya creado</CardTitle>
            <CardDescription>
              {attachmentsReadOnly
                ? "Esta cotizacion ya fue compartida. Desde aqui puedes revisar el PDF, reenviarla por WhatsApp y consultar sus adjuntos en solo lectura."
                : "Este borrador ya existe y desde esta pantalla solo puedes revisar o eliminar sus adjuntos. Para editar el contenido deberas volver al flujo correspondiente cuando exista una vista de edicion."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Numero del borrador: <span className="font-medium text-foreground">{currentDraft?.number}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-token bg-background text-foreground"
                onClick={() => router.replace("/cotizaciones/nueva")}
              >
                Nueva cotizacion
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-token bg-background text-foreground"
                onClick={() => router.push("/cotizaciones")}
              >
                Volver a cotizaciones
              </Button>
            </div>
          </CardContent>
        </Card>

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
    <form className="space-y-6" onSubmit={handleSubmit}>
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

      <Card className="border-token bg-surface shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">Arma tu cotizacion en una sola pantalla</CardTitle>
          <CardDescription>
              Elige un cliente, suma items manuales, del catalogo o desde una
              factura escaneada y revisa los totales antes de guardar el borrador.
          </CardDescription>
        </CardHeader>
      </Card>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {savedDraft ? (
        <div className="flex flex-col gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 md:flex-row md:items-center md:justify-between">
          <p>
            El borrador <span className="font-semibold">{savedDraft.number}</span> ya
            fue creado. Los datos quedaron bloqueados para evitar duplicados y ya
            puedes cargar adjuntos.
          </p>
          <Button
            type="button"
            variant="outline"
            className="border-token bg-background text-foreground"
            onClick={() => router.push("/cotizaciones")}
          >
            Ir a cotizaciones
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card className="border-token bg-surface shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">Cliente</CardTitle>
                  <CardDescription>
                    Puedes reutilizar un cliente cargado o crearlo dentro de esta
                    misma cotizacion.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={clientMode === "existing" ? "default" : "outline"}
                    className={
                      clientMode === "existing"
                        ? "bg-accent-token text-black hover:bg-accent-hover"
                        : "border-token bg-background"
                    }
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
                    className={
                      clientMode === "inline"
                        ? "bg-accent-token text-black hover:bg-accent-hover"
                        : "border-token bg-background"
                    }
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

          <InvoiceDropzone
            disabled={isFormLocked}
            persistedScan={invoiceScanReview}
            onScanPersisted={handleInvoiceScanPersisted}
            onScanComplete={handleInvoiceScanComplete}
          />

          <InvoiceItemsReview
            fileName={invoiceScanReview?.fileName ?? null}
            result={invoiceScanReview?.result ?? null}
            disabled={isFormLocked}
            onAddToQuotation={handleAddInvoiceItems}
            onClear={handleClearInvoiceScan}
          />

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

          <Card className="border-token bg-surface shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Ajustes del borrador</CardTitle>
              <CardDescription>
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

          <QuotationAttachments
            quotationId={currentDraft?.quotationId ?? null}
            initialAttachments={initialAttachments}
            readOnly={attachmentsReadOnly}
          />
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
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
