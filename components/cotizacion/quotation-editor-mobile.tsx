"use client";

import { useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Minus,
  Pencil,
  Percent,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import type { QuotationEditorItem } from "@/components/cotizacion/quotation-items-editor";
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
import { formatCurrencyAmount } from "@/lib/formatting";
import {
  calculateQuotationLineTotal,
  calculateQuotationTotals,
} from "@/lib/quotation-calculations";
import {
  getQuotationValidityBounds,
  getQuotationValidityPresetDate,
  sanitizeQuotationValidityDate,
} from "@/lib/quotation-validity";
import { formatDateOnly } from "@/lib/formatting";
import { useCotizacionStore } from "@/store/cotizacion-store";
import { cn } from "@/lib/utils";
import type {
  CatalogItem,
  Client,
  HydratedInvoiceScanReview,
  InvoiceScanItemDraft,
} from "@/types";

const validityPresets = [30, 60, 90] as const;
const textareaClassName =
  "flex min-h-24 w-full rounded-xl border border-token bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-token disabled:cursor-not-allowed disabled:opacity-50";

type QuotationEditorMobileProps = {
  clients: Client[];
  catalogItems: CatalogItem[];
  currency: string | null;
  disabled?: boolean;
  isSubmitting?: boolean;
  canSave: boolean;
  saveDisabled: boolean;
  onSubmit: () => void;
};

type ItemDraftFields = {
  name: string;
  quantity: string;
  unitPrice: string;
};

function getAvatarColor(name: string): string {
  const colors = [
    "bg-violet-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-pink-500",
    "bg-indigo-500",
  ];
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length] ?? "bg-[#00E5A0]";
}

function parseNumeric(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesCatalogItem(item: CatalogItem, query: string) {
  return [item.name, item.description ?? "", item.category ?? "", item.unit]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function QuotationEditorMobile({
  clients,
  catalogItems,
  currency,
  disabled = false,
  isSubmitting = false,
  canSave,
  saveDisabled,
  onSubmit,
}: QuotationEditorMobileProps) {
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

  const [clientSheetOpen, setClientSheetOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [addItemSheetOpen, setAddItemSheetOpen] = useState(false);
  const [manualSheetOpen, setManualSheetOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemFields, setItemFields] = useState<ItemDraftFields>({
    name: "",
    quantity: "1",
    unitPrice: "",
  });
  const [itemFieldError, setItemFieldError] = useState<string | null>(null);
  const [scanSheetOpen, setScanSheetOpen] = useState(false);
  const [invoiceScanReview, setInvoiceScanReview] =
    useState<HydratedInvoiceScanReview | null>(null);
  const [taxExpanded, setTaxExpanded] = useState(draft.taxRate > 0);
  const [taxInput, setTaxInput] = useState(
    draft.taxRate > 0 ? String(draft.taxRate) : "",
  );
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const items = draft.items;
  const taxRate = draft.taxRate;
  const validityBounds = useMemo(() => getQuotationValidityBounds(), []);
  const totals = useMemo(
    () => calculateQuotationTotals(items, taxRate),
    [items, taxRate],
  );

  const selectedClient =
    draft.clientMode === "existing" && draft.selectedClientId
      ? clients.find((client) => client.id === draft.selectedClientId) ?? null
      : null;
  const inlineClientName = draft.inlineClient.name.trim();
  const hasClient = Boolean(selectedClient) || Boolean(inlineClientName);
  const clientDisplayName = selectedClient?.name ?? inlineClientName;
  const clientPhone = selectedClient?.phone ?? draft.inlineClient.phone.trim() ?? null;

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

  const validUntilLabel = draft.validUntil
    ? formatDateOnly(sanitizeQuotationValidityDate(draft.validUntil))
    : "Sin fecha";

  function openClientSheet() {
    setCreatingClient(clients.length === 0);
    setClientSearch("");
    setClientSheetOpen(true);
  }

  function handleSelectExistingClient(client: Client) {
    setClientMode("existing");
    setSelectedClientId(client.id);
    setClientSheetOpen(false);
  }

  function handleSaveInlineClient() {
    if (!draft.inlineClient.name.trim()) {
      return;
    }
    setClientMode("inline");
    setSelectedClientId(null);
    setClientSheetOpen(false);
    setCreatingClient(false);
  }

  function clearClient() {
    setSelectedClientId(null);
    setInlineClient({ name: "", email: "", phone: "", address: "" });
    setClientMode(clients.length > 0 ? "existing" : "inline");
  }

  function openAddItemSheet() {
    setCatalogSearch("");
    setAddItemSheetOpen(true);
  }

  function handleQuickAddCatalogItem(catalogItem: CatalogItem) {
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
  }

  function openManualItemEditor(item?: QuotationEditorItem) {
    if (item) {
      setEditingItemId(item.id);
      setItemFields({
        name: item.name,
        quantity: String(item.quantity),
        unitPrice: item.unitPrice > 0 ? String(item.unitPrice) : "",
      });
    } else {
      setEditingItemId(null);
      setItemFields({ name: "", quantity: "1", unitPrice: "" });
    }
    setItemFieldError(null);
    setAddItemSheetOpen(false);
    // Pequeño delay para evitar choque de animaciones de sheets.
    window.setTimeout(() => setManualSheetOpen(true), 10);
  }

  function handleSaveManualItem() {
    const name = itemFields.name.trim();
    const quantity = parseNumeric(itemFields.quantity);
    const unitPrice = parseNumeric(itemFields.unitPrice);

    if (!name) {
      setItemFieldError("Escribí qué vas a cobrar.");
      return;
    }
    if (quantity === null || quantity <= 0) {
      setItemFieldError("La cantidad tiene que ser mayor a 0.");
      return;
    }
    if (unitPrice === null || unitPrice < 0) {
      setItemFieldError("Poné un precio válido.");
      return;
    }

    if (editingItemId) {
      updateItem(editingItemId, { name, quantity, unitPrice });
    } else {
      const nextId = allocNextItemId();
      addItem({
        id: `item-${nextId}`,
        source: "manual",
        catalogItemId: null,
        name,
        description: "",
        quantity,
        unit: "unidad",
        unitPrice,
      });
    }
    setManualSheetOpen(false);
  }

  function handleDeleteEditingItem() {
    if (editingItemId) {
      removeItem(editingItemId);
    }
    setManualSheetOpen(false);
  }

  function adjustItemQuantity(item: QuotationEditorItem, delta: number) {
    const nextQuantity = Math.max(1, item.quantity + delta);
    updateItem(item.id, { quantity: nextQuantity });
  }

  function handleAddScannedItems(scannedItems: InvoiceScanItemDraft[]) {
    scannedItems.forEach((scanItem) => {
      const nextId = allocNextItemId();
      addItem({
        id: `item-${nextId}`,
        source: "invoice",
        catalogItemId: null,
        name: scanItem.name,
        description: scanItem.description ?? "",
        quantity: scanItem.quantity,
        unit: scanItem.unit,
        unitPrice: scanItem.unitPrice,
      });
    });
    setScanSheetOpen(false);
  }

  function commitTaxInput(value: string) {
    setTaxInput(value);
    const parsed = parseNumeric(value);
    setTaxRate(parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : 0);
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col pb-28">
      <div className="space-y-3">
        {/* Cliente */}
        <Section title="Cliente">
          {hasClient ? (
            <button
              type="button"
              onClick={openClientSheet}
              disabled={disabled}
              className="flex w-full items-center gap-3 rounded-2xl border border-token bg-surface px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-50"
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white",
                  getAvatarColor(clientDisplayName || "C"),
                )}
              >
                {(clientDisplayName || "C").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-foreground">
                  {clientDisplayName || "Cliente nuevo"}
                </span>
                {clientPhone ? (
                  <span className="block truncate text-sm text-muted-foreground">
                    {clientPhone}
                  </span>
                ) : (
                  <span className="block text-sm text-muted-foreground">
                    Tocá para cambiar
                  </span>
                )}
              </span>
              <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <PrimaryAddButton
              icon={<UserPlus className="h-5 w-5" />}
              label="Agregar cliente"
              onClick={openClientSheet}
              disabled={disabled}
            />
          )}
        </Section>

        {/* Ítems */}
        <Section title="Ítems">
          {items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-token bg-surface px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openManualItemEditor(item)}
                      disabled={disabled}
                      className="min-w-0 flex-1 text-left disabled:opacity-50"
                    >
                      <p className="truncate text-base font-medium text-foreground">
                        {item.name || `Ítem ${index + 1}`}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatCurrencyAmount(item.unitPrice, currency)} c/u
                      </p>
                    </button>
                    <p className="shrink-0 text-base font-semibold text-foreground">
                      {formatCurrencyAmount(
                        calculateQuotationLineTotal(item.quantity, item.unitPrice),
                        currency,
                      )}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => adjustItemQuantity(item, -1)}
                        disabled={disabled}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-token bg-background text-foreground active:scale-95 disabled:opacity-50"
                        aria-label="Restar cantidad"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustItemQuantity(item, 1)}
                        disabled={disabled}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-token bg-background text-foreground active:scale-95 disabled:opacity-50"
                        aria-label="Sumar cantidad"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={disabled}
                      className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-destructive active:scale-95 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <PrimaryAddButton
            icon={<Plus className="h-5 w-5" />}
            label="Agregar ítem"
            onClick={openAddItemSheet}
            disabled={disabled}
          />

          {items.length > 0 ? (
            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-base font-semibold text-foreground">
                {formatCurrencyAmount(totals.subtotal, currency)}
              </span>
            </div>
          ) : null}
        </Section>

        {/* Impuesto */}
        <Section>
          {taxExpanded ? (
            <div className="rounded-2xl border border-token bg-surface px-4 py-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="mobile-tax" className="text-sm font-medium">
                  Impuesto (%)
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setTaxExpanded(false);
                    commitTaxInput("");
                  }}
                  className="text-muted-foreground"
                  aria-label="Quitar impuesto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Input
                  id="mobile-tax"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 21"
                  value={taxInput}
                  onChange={(event) => commitTaxInput(event.target.value)}
                  disabled={disabled}
                  className="min-h-12 flex-1"
                />
                <span className="text-sm font-medium text-muted-foreground">
                  {formatCurrencyAmount(totals.taxAmount, currency)}
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTaxExpanded(true)}
              disabled={disabled}
              className="flex w-full items-center justify-between rounded-2xl border border-dashed border-token bg-surface/60 px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-accent-token">
                <Percent className="h-4 w-4" />
                Agregar impuesto
              </span>
              <span className="text-sm text-muted-foreground">
                {formatCurrencyAmount(0, currency)}
              </span>
            </button>
          )}
        </Section>

        {/* Total */}
        <div className="flex items-center justify-between rounded-2xl border border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.08)] px-4 py-4">
          <span className="text-base font-semibold text-foreground">Total</span>
          <span className="text-2xl font-bold text-foreground">
            {formatCurrencyAmount(totals.total, currency)}
          </span>
        </div>

        {/* Validez */}
        <Section title="¿Hasta cuándo vale?">
          <div className="flex flex-wrap gap-2">
            {validityPresets.map((days) => {
              const presetDate = getQuotationValidityPresetDate(days);
              const isActive = draft.validUntil === presetDate;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setValidUntil(presetDate)}
                  disabled={disabled}
                  className={cn(
                    "min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium transition active:scale-[0.97] disabled:opacity-50",
                    isActive
                      ? "border-accent-token bg-[rgb(var(--accent-rgb)/0.12)] text-foreground"
                      : "border-token bg-surface text-muted-foreground",
                  )}
                >
                  {days} días
                </button>
              );
            })}
          </div>
          <Input
            type="date"
            value={draft.validUntil}
            min={validityBounds.minDate}
            max={validityBounds.maxDate}
            onChange={(event) => setValidUntil(event.target.value)}
            disabled={disabled}
            className="min-h-12"
          />
          <p className="px-1 text-xs text-muted-foreground">Vence: {validUntilLabel}</p>
        </Section>

        {/* Notas */}
        <Section title="Notas (opcional)">
          <textarea
            ref={notesRef}
            rows={3}
            value={draft.notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Condiciones, tiempos o aclaraciones para tu cliente"
            disabled={disabled}
            className={textareaClassName}
          />
        </Section>

        {/* Escanear factura */}
        <button
          type="button"
          onClick={() => setScanSheetOpen(true)}
          disabled={disabled}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-token bg-surface/60 px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-50"
        >
          <Camera className="h-5 w-5 shrink-0 text-accent-token" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Escanear factura
            </span>
            <span className="block text-xs text-muted-foreground">
              Sacá una foto y cargamos los ítems solos
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {/* Sticky guardar */}
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-token bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          type="button"
          className="min-h-14 w-full text-base active:scale-[0.99]"
          onClick={onSubmit}
          disabled={disabled || !canSave || isSubmitting || saveDisabled}
        >
          {isSubmitting
            ? "Guardando..."
            : `Guardar · ${formatCurrencyAmount(totals.total, currency)}`}
        </Button>
      </div>

      {/* Sheet: cliente */}
      <Sheet open={clientSheetOpen} onOpenChange={setClientSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-[1.75rem]"
        >
          <SheetHeader>
            <SheetTitle>{creatingClient ? "Nuevo cliente" : "Elegí el cliente"}</SheetTitle>
            <SheetDescription>
              {creatingClient
                ? "Cargá los datos del cliente para esta cotización."
                : "Tocá un cliente guardado o creá uno nuevo."}
            </SheetDescription>
          </SheetHeader>

          {creatingClient ? (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sheet-client-name">Nombre</Label>
                <Input
                  id="sheet-client-name"
                  value={draft.inlineClient.name}
                  onChange={(event) => setInlineClient({ name: event.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="min-h-12"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sheet-client-phone">Teléfono</Label>
                <Input
                  id="sheet-client-phone"
                  type="tel"
                  value={draft.inlineClient.phone}
                  onChange={(event) => setInlineClient({ phone: event.target.value })}
                  placeholder="261 555 1234"
                  className="min-h-12"
                />
              </div>
              <Button
                type="button"
                className="min-h-12 w-full"
                onClick={handleSaveInlineClient}
                disabled={!draft.inlineClient.name.trim()}
              >
                Usar este cliente
              </Button>
              {clients.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full text-muted-foreground"
                  onClick={() => setCreatingClient(false)}
                >
                  Elegir uno guardado
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {clients.length > 4 ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={clientSearch}
                    onChange={(event) => setClientSearch(event.target.value)}
                    placeholder="Buscar cliente"
                    className="min-h-12 pl-9"
                  />
                </div>
              ) : null}

              <div className="flex max-h-[45dvh] flex-col gap-1.5 overflow-y-auto">
                {filteredClients.map((client) => {
                  const isSelected = draft.selectedClientId === client.id;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelectExistingClient(client)}
                      className={cn(
                        "flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2 text-left transition active:scale-[0.99]",
                        isSelected
                          ? "border-accent-token bg-[rgb(var(--accent-rgb)/0.1)]"
                          : "border-token bg-surface",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                          getAvatarColor(client.name),
                        )}
                      >
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {client.name}
                        </span>
                        {client.phone ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {client.phone}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-accent-token" />
                      ) : null}
                    </button>
                  );
                })}
                {filteredClients.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No encontramos clientes con ese nombre.
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full border-dashed bg-background/60"
                onClick={() => {
                  setInlineClient({ name: "", email: "", phone: "", address: "" });
                  setCreatingClient(true);
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Crear cliente nuevo
              </Button>

              {hasClient ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full text-muted-foreground"
                  onClick={() => {
                    clearClient();
                    setClientSheetOpen(false);
                  }}
                >
                  Quitar cliente
                </Button>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet: agregar ítem (catálogo + manual + escaneo) */}
      <Sheet open={addItemSheetOpen} onOpenChange={setAddItemSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-[1.75rem]"
        >
          <SheetHeader>
            <SheetTitle>Agregar ítem</SheetTitle>
            <SheetDescription>
              Elegí del catálogo, cargá uno a mano o escaneá una factura.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <Button
              type="button"
              className="min-h-12 w-full"
              onClick={() => openManualItemEditor()}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Cargar ítem manual
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 w-full border-dashed bg-background/60"
              onClick={() => {
                setAddItemSheetOpen(false);
                window.setTimeout(() => setScanSheetOpen(true), 10);
              }}
            >
              <Camera className="mr-2 h-4 w-4" />
              Escanear factura
            </Button>

            {catalogItems.length > 0 ? (
              <>
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Tu catálogo
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {catalogItems.length > 6 ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      placeholder="Buscar en catálogo"
                      className="min-h-12 pl-9"
                    />
                  </div>
                ) : null}

                <div className="flex max-h-[40dvh] flex-col gap-1.5 overflow-y-auto">
                  {filteredCatalogItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleQuickAddCatalogItem(item)}
                      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-token bg-surface px-4 text-left transition active:scale-[0.99]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrencyAmount(item.price, currency)}/{item.unit}
                        </span>
                      </span>
                      <Plus className="h-5 w-5 shrink-0 text-accent-token" />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: ítem manual (crear/editar) */}
      <Sheet open={manualSheetOpen} onOpenChange={setManualSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-[1.75rem]"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle>{editingItemId ? "Editar ítem" : "Nuevo ítem"}</SheetTitle>
            <SheetDescription>Completá qué cobrás, cuánto y a qué precio.</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="manual-item-name">¿Qué vas a cobrar?</Label>
              <Input
                id="manual-item-name"
                value={itemFields.name}
                onChange={(event) => {
                  setItemFields((current) => ({ ...current, name: event.target.value }));
                  setItemFieldError(null);
                }}
                placeholder="Ej: Colocación de cañería"
                className="min-h-12"
                autoFocus={!editingItemId}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-item-qty">Cantidad</Label>
                <Input
                  id="manual-item-qty"
                  type="text"
                  inputMode="decimal"
                  value={itemFields.quantity}
                  onChange={(event) => {
                    setItemFields((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }));
                    setItemFieldError(null);
                  }}
                  className="min-h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-item-price">Precio unitario</Label>
                <Input
                  id="manual-item-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 15000"
                  value={itemFields.unitPrice}
                  onChange={(event) => {
                    setItemFields((current) => ({
                      ...current,
                      unitPrice: event.target.value,
                    }));
                    setItemFieldError(null);
                  }}
                  className="min-h-12"
                />
              </div>
            </div>

            {itemFieldError ? (
              <p className="text-sm text-destructive">{itemFieldError}</p>
            ) : null}

            <Button
              type="button"
              className="min-h-12 w-full"
              onClick={handleSaveManualItem}
            >
              {editingItemId ? "Guardar cambios" : "Agregar ítem"}
            </Button>
            {editingItemId ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full text-destructive"
                onClick={handleDeleteEditingItem}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Quitar de la cotización
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet: escaneo */}
      <Sheet open={scanSheetOpen} onOpenChange={setScanSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto rounded-t-[1.75rem]"
        >
          <SheetHeader>
            <SheetTitle>Escanear factura</SheetTitle>
            <SheetDescription>
              Sacá una foto y revisá los ítems antes de sumarlos.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <InvoiceDropzone
              disabled={disabled}
              persistedScan={invoiceScanReview}
              onScanPersisted={(scan) =>
                setInvoiceScanReview((current) =>
                  current?.scanId === scan.scanId && current.result
                    ? { ...current, ...scan }
                    : { ...scan, result: null },
                )
              }
              onScanComplete={(scan) =>
                setInvoiceScanReview({
                  scanId: scan.scanId,
                  fileName: scan.fileName,
                  status: "completed",
                  failureMessage: null,
                  result: scan.result,
                })
              }
            />
            <InvoiceItemsReview
              fileName={invoiceScanReview?.fileName ?? null}
              result={invoiceScanReview?.result ?? null}
              disabled={disabled}
              onAddToQuotation={handleAddScannedItems}
              onClear={() => setInvoiceScanReview(null)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-[1.5rem] border border-token bg-[#0F1117] p-4">
      {title ? (
        <p className="px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function PrimaryAddButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent-token text-base font-semibold text-black transition hover:bg-accent-hover active:scale-[0.99] disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}
