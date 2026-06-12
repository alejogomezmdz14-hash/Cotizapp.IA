"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Mic,
  PackagePlus,
  Plus,
  Search,
} from "lucide-react";

import type { QuotationEditorItem } from "@/components/cotizacion/quotation-items-editor";
import { QuotationSummary } from "@/components/cotizacion/quotation-summary";
import { InvoiceDropzone } from "@/components/uploads/invoice-dropzone";
import { InvoiceItemsReview } from "@/components/uploads/invoice-items-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { formatCurrencyAmount } from "@/lib/formatting";
import { calculateQuotationLineTotal, calculateQuotationTotals } from "@/lib/quotation-calculations";
import {
  getQuotationValidityBounds,
  getQuotationValidityPresetDate,
} from "@/lib/quotation-validity";
import { useCotizacionStore } from "@/store/cotizacion-store";
import { cn } from "@/lib/utils";
import type {
  CatalogItem,
  Client,
  HydratedInvoiceScanReview,
  InvoiceScanItemDraft,
} from "@/types";

const validityPresets = [30, 60, 90] as const;
const stepTitles = ["Cliente", "Ítems", "Detalles", "Revisar"] as const;
const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type QuotationWizardProps = {
  clients: Client[];
  catalogItems: CatalogItem[];
  currency: string | null;
  disabled?: boolean;
  isSubmitting?: boolean;
  canSave: boolean;
  saveDisabled: boolean;
  onSubmit: () => void;
};

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

function matchesCatalogItem(item: CatalogItem, query: string) {
  const searchTarget = [item.name, item.description ?? "", item.category ?? "", item.unit]
    .join(" ")
    .toLowerCase();
  return searchTarget.includes(query);
}

function ItemConceptField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { supportsSpeech, isListening, voiceError, toggleListening } = useSpeechInput({
    value,
    onChange,
  });

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ej: Colocación de cañería 2 pulgadas"
          disabled={disabled}
          className="min-h-12 pr-12"
        />
        {supportsSpeech ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2",
              isListening && "text-accent-token",
            )}
            onClick={toggleListening}
            disabled={disabled}
            aria-label={isListening ? "Detener dictado" : "Dictar concepto"}
          >
            <Mic className="h-5 w-5" />
          </Button>
        ) : null}
      </div>
      {voiceError ? <p className="text-xs text-destructive">{voiceError}</p> : null}
    </div>
  );
}

export function QuotationWizard({
  clients,
  catalogItems,
  currency,
  disabled = false,
  isSubmitting = false,
  canSave,
  saveDisabled,
  onSubmit,
}: QuotationWizardProps) {
  const draft = useCotizacionStore((state) => state.draft);
  const setClientMode = useCotizacionStore((state) => state.setClientMode);
  const setSelectedClientId = useCotizacionStore((state) => state.setSelectedClientId);
  const setInlineClient = useCotizacionStore((state) => state.setInlineClient);
  const addItem = useCotizacionStore((state) => state.addItem);
  const removeItem = useCotizacionStore((state) => state.removeItem);
  const setTaxRateInput = useCotizacionStore((state) => state.setTaxRateInput);
  const syncTaxRateFromInput = useCotizacionStore((state) => state.syncTaxRateFromInput);
  const setValidUntil = useCotizacionStore((state) => state.setValidUntil);
  const setNotes = useCotizacionStore((state) => state.setNotes);
  const setWizardStep = useCotizacionStore((state) => state.setWizardStep);
  const allocNextItemId = useCotizacionStore((state) => state.allocNextItemId);

  const [clientSearch, setClientSearch] = useState("");
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const suppressCatalogOpenRef = useRef(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [scanSheetOpen, setScanSheetOpen] = useState(false);
  const [invoiceScanReview, setInvoiceScanReview] =
    useState<HydratedInvoiceScanReview | null>(null);
  const [newItemDraft, setNewItemDraft] = useState({
    name: "",
    quantity: "1",
    unitPrice: "",
  });
  const [inlineNameError, setInlineNameError] = useState<string | null>(null);
  const [existingClientError, setExistingClientError] = useState<string | null>(null);
  const [itemsStepError, setItemsStepError] = useState<string | null>(null);
  const [newItemFieldErrors, setNewItemFieldErrors] = useState<{
    quantity?: string;
    unitPrice?: string;
  }>({});

  const step = draft.wizardStep;
  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;
  const validityBounds = useMemo(() => getQuotationValidityBounds(), []);
  const taxRateForTotals = useMemo(() => {
    const parsed = Number.parseFloat(draft.taxRateInput.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }, [draft.taxRateInput]);

  const summaryTotals = useMemo(
    () => calculateQuotationTotals(draft.items, taxRateForTotals),
    [draft.items, taxRateForTotals],
  );

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) {
      return clients;
    }
    return clients.filter((client) =>
      [client.name, client.email ?? "", client.phone ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [clientSearch, clients]);

  const filteredCatalogItems = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    if (!query) {
      return catalogItems;
    }
    return catalogItems.filter((item) => matchesCatalogItem(item, query));
  }, [catalogItems, catalogSearch]);

  const selectedClientName =
    clients.find((client) => client.id === draft.selectedClientId)?.name ?? null;

  function handleItemSheetOpenChange(open: boolean) {
    setItemSheetOpen(open);

    if (!open) {
      suppressCatalogOpenRef.current = true;
      setCatalogOpen(false);
      window.setTimeout(() => {
        suppressCatalogOpenRef.current = false;
      }, 350);
    }
  }

  function handleCatalogOpenChange(open: boolean) {
    if (open && suppressCatalogOpenRef.current) {
      return;
    }

    setCatalogOpen(open);

    if (open) {
      setItemSheetOpen(false);
    }
  }

  function openItemSheet() {
    setCatalogOpen(false);
    setNewItemFieldErrors({});
    setItemSheetOpen(true);
  }

  function goNext() {
    if (step === 1 && !canAdvanceFromStep(1)) {
      if (draft.clientMode === "inline") {
        setInlineNameError("El nombre es obligatorio.");
      } else {
        setExistingClientError("Seleccioná un cliente para continuar.");
      }
      return;
    }

    if (step === 2 && !canAdvanceFromStep(2)) {
      setItemsStepError("Agregá al menos un trabajo o material para continuar.");
      return;
    }

    setInlineNameError(null);
    setExistingClientError(null);
    setItemsStepError(null);

    if (step === 3) {
      syncTaxRateFromInput();
    }
    setWizardStep(Math.min(step + 1, totalSteps));
  }

  function goBack() {
    setWizardStep(Math.max(step - 1, 1));
  }

  function handleAddManualItemFromSheet() {
    const trimmedName = newItemDraft.name.trim();
    const quantity = Number.parseFloat(newItemDraft.quantity);
    const unitPrice = Number.parseFloat(newItemDraft.unitPrice);
    const fieldErrors: { quantity?: string; unitPrice?: string } = {};

    if (!Number.isFinite(quantity) || quantity <= 0) {
      fieldErrors.quantity = "La cantidad debe ser mayor a 0.";
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      fieldErrors.unitPrice = "El precio debe ser mayor a 0.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setNewItemFieldErrors(fieldErrors);
      return;
    }

    setNewItemFieldErrors({});
    const nextId = allocNextItemId();
    const item: QuotationEditorItem = {
      id: `item-${nextId}`,
      source: "manual",
      catalogItemId: null,
      name: trimmedName,
      description: "",
      quantity,
      unit: "unidad",
      unitPrice,
    };
    addItem(item);
    setNewItemDraft({ name: "", quantity: "1", unitPrice: "" });
    handleItemSheetOpenChange(false);
  }

  function handleAddInvoiceItems(scannedItems: InvoiceScanItemDraft[]) {
    if (scannedItems.length === 0) {
      return;
    }

    scannedItems.forEach((item) => {
      const nextId = allocNextItemId();
      addItem(createInvoiceItemDraft(nextId, item));
    });
    setScanSheetOpen(false);
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
  }

  function handleClearInvoiceScan() {
    setInvoiceScanReview(null);
  }

  function handleAddCatalogItem(catalogItem: CatalogItem) {
    const nextId = allocNextItemId();
    addItem({
      id: `item-${nextId}`,
      source: "catalog",
      catalogItemId: catalogItem.id,
      name: catalogItem.name,
      description: catalogItem.description ?? "",
      quantity: 1,
      unit: catalogItem.unit,
      unitPrice: catalogItem.price,
    });
    handleItemSheetOpenChange(false);
    handleCatalogOpenChange(false);
  }

  function canAdvanceFromStep(currentStep: number) {
    if (currentStep === 1) {
      if (draft.clientMode === "existing") {
        return Boolean(draft.selectedClientId);
      }
      return Boolean(draft.inlineClient.name.trim());
    }
    if (currentStep === 2) {
      return draft.items.length > 0;
    }
    return true;
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col pb-28">
      <div className="sticky top-0 z-20 border-b border-token/80 bg-background/95 backdrop-blur">
        <div className="h-1 bg-surface-2">
          <div
            className="h-full bg-accent-token transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid grid-cols-[4rem_1fr_4rem] items-center px-4 py-3">
          {step > 1 ? (
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-1 justify-self-start text-sm font-medium text-muted-foreground"
              onClick={goBack}
              disabled={disabled}
            >
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </button>
          ) : (
            <span className="min-h-12" />
          )}
          <span className="justify-self-center text-sm font-medium text-foreground">
            Paso {step} de {totalSteps}
            <span className="text-muted-foreground"> · {stepTitles[step - 1]}</span>
          </span>
          <span className="min-h-12" />
        </div>
      </div>

      <div className="flex-1 px-4 py-5">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Cliente</h2>
              <p className="text-sm text-muted-foreground">
                Elegí quién recibe esta cotización.
              </p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Buscar cliente"
                className="min-h-12 pl-9"
                disabled={disabled}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={draft.clientMode === "existing" ? "default" : "outline"}
                className="min-h-12 flex-1"
                onClick={() => {
                  setInlineNameError(null);
                  setExistingClientError(null);
                  setClientMode("existing");
                }}
                disabled={disabled || clients.length === 0}
              >
                Mis clientes
              </Button>
              <Button
                type="button"
                variant={draft.clientMode === "inline" ? "default" : "outline"}
                className="min-h-12 flex-1"
                onClick={() => {
                  setSelectedClientId(null);
                  setInlineNameError(null);
                  setExistingClientError(null);
                  setClientMode("inline");
                }}
                disabled={disabled}
              >
                Crear cliente nuevo
              </Button>
            </div>

            {draft.clientMode === "existing" ? (
              <div className="space-y-2">
                {filteredClients.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-token px-4 py-8 text-center text-sm text-muted-foreground">
                    No hay clientes para mostrar. Podés cargar uno nuevo.
                  </p>
                ) : (
                  filteredClients.map((client) => {
                    const selected = draft.selectedClientId === client.id;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        className={cn(
                          "flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99]",
                          selected
                            ? "border-accent-token bg-[rgb(var(--accent-rgb)/0.08)]"
                            : "border-token bg-background/75",
                        )}
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setExistingClientError(null);
                        }}
                        disabled={disabled}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent-rgb)/0.15)] text-base font-bold text-accent-token">
                          {client.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-medium">
                            {client.name}
                          </span>
                          {client.phone ? (
                            <span className="block text-sm text-muted-foreground">
                              {client.phone}
                            </span>
                          ) : null}
                        </span>
                        {selected ? (
                          <Check className="h-5 w-5 shrink-0 text-accent-token" />
                        ) : null}
                      </button>
                    );
                  })
                )}
                {existingClientError ? (
                  <p className="text-sm text-destructive">{existingClientError}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="wizard-inline-name">Nombre</Label>
                  <Input
                    id="wizard-inline-name"
                    value={draft.inlineClient.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      setInlineClient({ name });
                      if (name.trim()) {
                        setInlineNameError(null);
                      }
                    }}
                    onBlur={() => {
                      if (!draft.inlineClient.name.trim()) {
                        setInlineNameError("El nombre es obligatorio.");
                      }
                    }}
                    placeholder="Ej. Constructora Andina"
                    className="min-h-12"
                    disabled={disabled}
                    aria-invalid={Boolean(inlineNameError)}
                  />
                  {inlineNameError ? (
                    <p className="text-sm text-destructive">{inlineNameError}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-inline-phone">Teléfono</Label>
                  <Input
                    id="wizard-inline-phone"
                    type="tel"
                    value={draft.inlineClient.phone}
                    onChange={(event) => setInlineClient({ phone: event.target.value })}
                    placeholder="261 555 1234"
                    className="min-h-12"
                    disabled={disabled}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Ítems</h2>
              <p className="text-sm text-muted-foreground">
                Cargá lo que vas a cotizar.
              </p>
            </div>

            {draft.items.length === 0 ? (
              <div className="space-y-2">
                <p className="rounded-xl border border-dashed border-token px-4 py-8 text-center text-sm text-muted-foreground">
                  Agregá el primer trabajo o material con el botón de abajo.
                </p>
                {itemsStepError ? (
                  <p className="text-sm text-destructive">{itemsStepError}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {draft.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-token bg-background/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium">{item.name || `Ítem ${index + 1}`}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × {formatCurrencyAmount(item.unitPrice, currency)}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold">
                        {formatCurrencyAmount(
                          calculateQuotationLineTotal(item.quantity, item.unitPrice),
                          currency,
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-2 min-h-12 text-destructive"
                      onClick={() => removeItem(item.id)}
                      disabled={disabled}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)] px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Subtotal ({draft.items.length}{" "}
                    {draft.items.length === 1 ? "ítem" : "ítems"})
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    {formatCurrencyAmount(summaryTotals.subtotal, currency)}
                  </span>
                </div>
              </div>
            )}

            <Button
              type="button"
              className="min-h-12 w-full"
              onClick={openItemSheet}
              disabled={disabled}
            >
              <Plus className="mr-2 h-5 w-5" />
              Agregar trabajo o material
            </Button>

            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full border-token bg-background/75"
              onClick={() => {
                setItemSheetOpen(false);
                setCatalogOpen(true);
              }}
              disabled={disabled}
            >
              <PackagePlus className="mr-2 h-5 w-5" />
              Elegir del catálogo
            </Button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                o
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full border-dashed bg-background/60"
                onClick={() => setScanSheetOpen(true)}
                disabled={disabled}
              >
                <Camera className="mr-2 h-5 w-5" />
                Subir foto de factura (opcional)
              </Button>
              <p className="text-sm leading-6 text-muted-foreground">
                Sacale una foto a una factura o ticket de compra y el sistema carga los
                ítems solo. Útil para cargar materiales que compraste para el trabajo.
              </p>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Notas e impuesto</h2>
              <p className="text-sm text-muted-foreground">
                Agregá una nota para tu cliente y el impuesto si corresponde.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-notes">Notas (opcional)</Label>
              <textarea
                id="wizard-notes"
                rows={4}
                value={draft.notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Condiciones, tiempos o aclaraciones para tu cliente"
                disabled={disabled}
                className={textareaClassName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-tax">Impuesto (%)</Label>
              <Input
                id="wizard-tax"
                type="number"
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="Ej: 21"
                value={draft.taxRateInput}
                onChange={(event) => setTaxRateInput(event.target.value)}
                onBlur={() => syncTaxRateFromInput()}
                className="min-h-12"
                disabled={disabled}
              />
              <p className="text-sm text-muted-foreground">
                Dejalo vacío si no aplicás impuesto.
              </p>
            </div>

            <div className="space-y-2">
              <Label>¿Cuándo vence?</Label>
              <div className="flex flex-wrap gap-2">
                {validityPresets.map((days) => {
                  const presetDate = getQuotationValidityPresetDate(days);
                  const isActive = draft.validUntil === presetDate;

                  return (
                    <Button
                      key={days}
                      type="button"
                      variant={isActive ? "default" : "outline"}
                      className={cn(
                        "min-h-12 px-6",
                        !isActive && "bg-background/75",
                      )}
                      onClick={() => setValidUntil(presetDate)}
                      disabled={disabled}
                    >
                      {days} días
                    </Button>
                  );
                })}
              </div>
              <Input
                type="date"
                value={draft.validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                min={validityBounds.minDate}
                max={validityBounds.maxDate}
                className="min-h-12"
                disabled={disabled}
              />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-token bg-background/75 p-4">
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="mt-1 font-medium">
                {draft.clientMode === "existing"
                  ? selectedClientName ?? "Sin cliente"
                  : draft.inlineClient.name.trim() || "Nuevo cliente"}
              </p>
            </div>

            <QuotationSummary
              items={draft.items}
              currency={currency}
              taxRate={taxRateForTotals}
              validUntil={draft.validUntil}
              isSubmitting={isSubmitting}
              isSaved={false}
              saveDisabled={saveDisabled}
              quotationId={null}
              draftNumber={null}
              pdfGeneratedAt={null}
              shareToken={null}
              sentAt={null}
              hideSaveButton
            />
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-token bg-background/95 px-4 py-3 backdrop-blur">
        {step < 4 ? (
          <Button
            type="button"
            className="min-h-14 w-full text-base active:scale-[0.99]"
            onClick={goNext}
            disabled={disabled}
          >
            Siguiente
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              type="button"
              className="min-h-14 w-full text-base"
              onClick={() => {
                syncTaxRateFromInput();
                onSubmit();
              }}
              disabled={disabled || !canSave || isSubmitting}
            >
              {isSubmitting ? "Guardando..." : "Guardar cotización"}
            </Button>
            <p className="text-center text-sm font-semibold text-foreground">
              Total: {formatCurrencyAmount(summaryTotals.total, currency)}
            </p>
          </div>
        )}
      </div>

      <Sheet open={itemSheetOpen} onOpenChange={handleItemSheetOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-[1.75rem]"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>Nuevo ítem</SheetTitle>
            <SheetDescription>Completá cantidad y precio del trabajo o material.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>¿Qué vas a cobrar?</Label>
              <ItemConceptField
                value={newItemDraft.name}
                onChange={(name) => setNewItemDraft((current) => ({ ...current, name }))}
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  min="0.01"
                  step="0.01"
                  value={newItemDraft.quantity}
                  onChange={(event) => {
                    setNewItemDraft((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }));
                    setNewItemFieldErrors((current) => ({ ...current, quantity: undefined }));
                  }}
                  className="min-h-12"
                  disabled={disabled}
                  aria-invalid={Boolean(newItemFieldErrors.quantity)}
                />
                {newItemFieldErrors.quantity ? (
                  <p className="text-sm text-destructive">{newItemFieldErrors.quantity}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Precio unitario</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  min="0.01"
                  step="0.01"
                  placeholder="Ej: 15000"
                  value={newItemDraft.unitPrice}
                  onChange={(event) => {
                    setNewItemDraft((current) => ({
                      ...current,
                      unitPrice: event.target.value,
                    }));
                    setNewItemFieldErrors((current) => ({ ...current, unitPrice: undefined }));
                  }}
                  className="min-h-12"
                  disabled={disabled}
                  aria-invalid={Boolean(newItemFieldErrors.unitPrice)}
                />
                {newItemFieldErrors.unitPrice ? (
                  <p className="text-sm text-destructive">{newItemFieldErrors.unitPrice}</p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              className="min-h-12 w-full"
              onClick={handleAddManualItemFromSheet}
              disabled={disabled || !newItemDraft.name.trim()}
            >
              Agregar ítem
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={scanSheetOpen} onOpenChange={setScanSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto rounded-t-[1.75rem]"
        >
          <SheetHeader>
            <SheetTitle>Escanear factura de proveedor</SheetTitle>
            <SheetDescription>
              Es opcional. Sacá una foto y revisá los ítems antes de sumarlos a la
              cotización.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <InvoiceDropzone
              disabled={disabled}
              persistedScan={invoiceScanReview}
              onScanPersisted={handleInvoiceScanPersisted}
              onScanComplete={handleInvoiceScanComplete}
            />
            <InvoiceItemsReview
              fileName={invoiceScanReview?.fileName ?? null}
              result={invoiceScanReview?.result ?? null}
              disabled={disabled}
              onAddToQuotation={handleAddInvoiceItems}
              onClear={handleClearInvoiceScan}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={catalogOpen} onOpenChange={handleCatalogOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-[1.75rem]"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>Desde mi catálogo</SheetTitle>
            <SheetDescription>Elegí un producto o servicio guardado.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Input
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="Buscar en catálogo"
              className="min-h-12"
            />
            {filteredCatalogItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex min-h-16 w-full items-center justify-between rounded-xl border border-token px-4 text-left"
                onClick={() => handleAddCatalogItem(item)}
                disabled={disabled}
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {formatCurrencyAmount(item.price, currency)}
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
