"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, RefreshCcw } from "lucide-react";

import { createCatalogItemsFromInvoiceAction } from "@/app/actions/catalog";
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
import { formatCurrencyAmount } from "@/lib/formatting";
import {
  applyInvoiceReviewMargin,
  createInvoiceReviewItems,
  markSavedCatalogRows,
  parseInvoiceDecimalValue,
  removeAppliedQuotationRows,
  toInvoiceDraft,
  updateInvoiceReviewDestination,
  type EditableInvoiceReviewItem,
  type InvoiceReviewDestination,
} from "@/lib/invoice-scan/review";
import { cn } from "@/lib/utils";
import type { InvoiceScanItemDraft, InvoiceScanResult } from "@/types";

type InvoiceItemsReviewProps = {
  fileName: string | null;
  result: InvoiceScanResult | null;
  disabled?: boolean;
  onAddToQuotation: (items: InvoiceScanItemDraft[]) => void;
  onClear: () => void;
};

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type RowFieldDraft = {
  quantity: string;
  unitPrice: string;
  margin: string;
};

function buildFieldDrafts(rows: EditableInvoiceReviewItem[]) {
  const drafts: Record<string, RowFieldDraft> = {};

  for (const row of rows) {
    drafts[row.id] = {
      quantity: String(row.quantity),
      unitPrice: String(row.unitPrice),
      margin: row.marginPct > 0 ? String(row.marginPct) : "",
    };
  }

  return drafts;
}

const destinationOptions: Array<{
  value: InvoiceReviewDestination;
  label: string;
}> = [
  { value: "quotation", label: "Cotización" },
  { value: "catalog", label: "Catálogo" },
  { value: "discard", label: "Descartar" },
];

function getDestinationCardClassName(destination: InvoiceReviewDestination) {
  switch (destination) {
    case "quotation":
      return "border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)]";
    case "catalog":
      return "border-token/80 bg-background/70";
    case "discard":
      return "border-token/70 bg-background/45 opacity-70";
    default:
      return "border-token/80 bg-background/70";
  }
}

export function InvoiceItemsReview({
  fileName,
  result,
  disabled = false,
  onAddToQuotation,
  onClear,
}: InvoiceItemsReviewProps) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableInvoiceReviewItem[]>(() =>
    createInvoiceReviewItems(result),
  );
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, RowFieldDraft>>(
    () => buildFieldDrafts(createInvoiceReviewItems(result)),
  );
  const [globalMargin, setGlobalMargin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const [isApplyingQuotation, setIsApplyingQuotation] = useState(false);

  useEffect(() => {
    const nextRows = createInvoiceReviewItems(result);
    setRows(nextRows);
    setFieldDrafts(buildFieldDrafts(nextRows));
    setGlobalMargin("");
    setError(null);
    setStatus(null);
  }, [result, fileName]);

  const quotationSelection = useMemo(
    () => rows.filter((row) => row.destination === "quotation"),
    [rows],
  );
  const catalogSelection = useMemo(
    () => rows.filter((row) => row.destination === "catalog"),
    [rows],
  );
  const discardedSelection = useMemo(
    () => rows.filter((row) => row.destination === "discard"),
    [rows],
  );

  const isBusy = disabled || isSavingCatalog || isApplyingQuotation;

  function updateRow(
    rowId: string,
    updates: Partial<EditableInvoiceReviewItem>,
  ) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
    );
  }

  function updateFieldDraft(rowId: string, updates: Partial<RowFieldDraft>) {
    setFieldDrafts((currentDrafts) => ({
      ...currentDrafts,
      [rowId]: { ...currentDrafts[rowId], ...updates } as RowFieldDraft,
    }));
  }

  function commitQuantity(rowId: string) {
    const draft = fieldDrafts[rowId];
    if (!draft) return;
    const parsed = parseInvoiceDecimalValue(draft.quantity);
    const quantity = parsed > 0 ? parsed : 1;
    updateRow(rowId, { quantity });
    updateFieldDraft(rowId, { quantity: String(quantity) });
  }

  function commitUnitPrice(rowId: string) {
    const draft = fieldDrafts[rowId];
    if (!draft) return;
    const unitPrice = Math.round(parseInvoiceDecimalValue(draft.unitPrice) * 100) / 100;
    updateRow(rowId, { unitPrice });
    updateFieldDraft(rowId, { unitPrice: String(unitPrice) });
  }

  function commitMargin(rowId: string) {
    const draft = fieldDrafts[rowId];
    if (!draft) return;
    const parsed = parseInvoiceDecimalValue(draft.margin);
    const marginPct = parsed > 0 && parsed <= 1000 ? parsed : 0;
    updateRow(rowId, { marginPct });
    updateFieldDraft(rowId, { margin: marginPct > 0 ? String(marginPct) : "" });
  }

  function handleApplyGlobalMargin() {
    const parsed = parseInvoiceDecimalValue(globalMargin);
    const marginPct = parsed > 0 && parsed <= 1000 ? parsed : 0;

    setRows((currentRows) =>
      currentRows.map((row) => ({ ...row, marginPct })),
    );
    setFieldDrafts((currentDrafts) => {
      const nextDrafts: Record<string, RowFieldDraft> = {};
      for (const [rowId, draft] of Object.entries(currentDrafts)) {
        nextDrafts[rowId] = {
          ...draft,
          margin: marginPct > 0 ? String(marginPct) : "",
        };
      }
      return nextDrafts;
    });
  }

  function handleDestinationChange(
    rowId: string,
    destination: InvoiceReviewDestination,
  ) {
    setRows((currentRows) =>
      updateInvoiceReviewDestination(currentRows, rowId, destination),
    );
  }

  async function handleApplyToQuotation() {
    if (quotationSelection.length === 0) {
      setError("Seleccioná al menos un ítem para agregar a la cotización.");
      return;
    }

    const confirmed = window.confirm(
      `Se van a agregar ${quotationSelection.length} ítem(s) a la cotización actual. Podés seguir ajustándolos después. ¿Querés continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setIsApplyingQuotation(true);
    setError(null);
    setStatus(null);

    try {
      onAddToQuotation(quotationSelection.map(toInvoiceDraft));
      setRows((currentRows) => removeAppliedQuotationRows(currentRows));
      setStatus("Ítems agregados a la cotización actual.");
    } finally {
      setIsApplyingQuotation(false);
    }
  }

  async function handleSaveToCatalog() {
    if (catalogSelection.length === 0) {
      setError("Seleccioná al menos un ítem para guardar en el catálogo.");
      return;
    }

    const confirmed = window.confirm(
      `Esto va a guardar ${catalogSelection.length} ítem(s) en tu catálogo con los datos que revisaste. ¿Querés continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setIsSavingCatalog(true);
    setError(null);
    setStatus(null);

    try {
      const result = await createCatalogItemsFromInvoiceAction(
        catalogSelection.map((row) => ({
          id: row.id,
          ...toInvoiceDraft(row),
        })),
      );
      setRows((currentRows) => markSavedCatalogRows(currentRows, result.savedRowIds));
      setStatus(
        result.skippedCount > 0
          ? `Se guardaron ${result.createdCount} ítem(s) en el catálogo. Se omitieron ${result.skippedCount} fila(s) inválida(s).`
          : result.createdCount === 1
            ? "1 ítem guardado en el catálogo."
            : `${result.createdCount} ítems guardados en el catálogo.`,
      );
      router.refresh();
    } catch (catalogError) {
      setError(
        catalogError instanceof Error && catalogError.message.trim()
          ? catalogError.message
          : "No se pudieron guardar los ítems seleccionados.",
      );
    } finally {
      setIsSavingCatalog(false);
    }
  }

  if (!result) {
    return (
      <Card className="shell-panel overflow-hidden shadow-none">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Revisión del escaneo</CardTitle>
          <CardDescription className="leading-6">
            Cuando la IA termine de leer tu factura, acá vas a poder corregir
            cada renglón y decidir si va a la cotización, al catálogo o se
            descarta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.75rem] border border-dashed border-token/80 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
            Cargá una factura para empezar. Nada se guarda sin tu revisión.
          </div>
        </CardContent>
      </Card>
    );
  }

  const currency = result.currency ?? null;

  return (
    <Card className="shell-panel overflow-hidden shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-accent-token">
              <FileSpreadsheet className="h-4 w-4" />
              Resultado del escaneo
            </div>
            <CardTitle className="text-xl">Revisá los ítems detectados</CardTitle>
            <CardDescription>
              Nada se guarda automáticamente. Corregí los datos, elegí el
              destino de cada ítem y confirmá abajo.
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 bg-background/75"
            onClick={onClear}
            disabled={isBusy}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Limpiar revisión
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Archivo
            </p>
            <p className="mt-2 truncate text-sm font-medium text-foreground">
              {fileName ?? "Factura sin nombre"}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Proveedor
            </p>
            <p className="mt-2 truncate text-sm font-medium text-foreground">
              {result.supplierName ?? "No detectado"}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Ítems detectados
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {result.items.length}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Para cotización
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {quotationSelection.length}
            </p>
          </div>
        </div>

        {result.notes ? (
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Notas del escaneo:</span>{" "}
            {result.notes}
          </div>
        ) : null}

        {result.warnings.length > 0 ? (
          <div className="rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">Revisá estos avisos</p>
            <ul className="mt-2 space-y-1">
              {result.warnings.map((warning) => (
                <li key={warning}>- {warning}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Escaneo listo. Revisá los datos antes de confirmar.
            </div>
          </div>
        )}

        {rows.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-[1.5rem] border border-token/80 bg-background/70 p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invoice-global-margin">
                Margen de ganancia (%)
              </Label>
              <Input
                id="invoice-global-margin"
                type="text"
                inputMode="decimal"
                placeholder="Ej: 30"
                value={globalMargin}
                onChange={(event) => setGlobalMargin(event.target.value)}
                disabled={isBusy}
                className="min-h-12"
              />
              <p className="text-xs text-muted-foreground">
                Lo que detecta la factura es tu costo. El margen se suma para
                calcular el precio que le cobrás a tu cliente.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 bg-background/75"
              onClick={handleApplyGlobalMargin}
              disabled={isBusy}
            >
              Aplicar a todos
            </Button>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-token/80 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
            {result.items.length === 0
              ? "No encontramos ítems claros en esta factura. Probá con otra imagen más nítida o cargá los conceptos a mano."
              : "No quedan ítems pendientes en esta revisión. Podés limpiar la revisión o subir otra factura."}
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map((row, index) => {
              const draft = fieldDrafts[row.id] ?? {
                quantity: String(row.quantity),
                unitPrice: String(row.unitPrice),
                margin: row.marginPct > 0 ? String(row.marginPct) : "",
              };
              const salePrice = applyInvoiceReviewMargin(
                row.unitPrice,
                row.marginPct,
              );

              return (
                <div
                  key={row.id}
                  className={`space-y-4 rounded-[1.75rem] border p-4 transition ${getDestinationCardClassName(row.destination)}`}
                >
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-foreground">
                      Ítem {index + 1}
                    </p>

                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-token/80 bg-background/60 p-1">
                      {destinationOptions.map((option) => {
                        const isActive = row.destination === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleDestinationChange(row.id, option.value)
                            }
                            className={cn(
                              "min-h-11 rounded-lg px-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50",
                              isActive
                                ? option.value === "discard"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-[rgb(var(--accent-rgb)/0.16)] text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div className="space-y-2">
                      <Label htmlFor={`${row.id}-name`}>Concepto</Label>
                      <Input
                        id={`${row.id}-name`}
                        value={row.name}
                        onChange={(event) =>
                          updateRow(row.id, { name: event.target.value })
                        }
                        disabled={isBusy}
                        className="min-h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${row.id}-unit`}>Unidad</Label>
                      <Input
                        id={`${row.id}-unit`}
                        value={row.unit}
                        onChange={(event) =>
                          updateRow(row.id, { unit: event.target.value })
                        }
                        disabled={isBusy}
                        className="min-h-12"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`${row.id}-quantity`}>Cantidad</Label>
                      <Input
                        id={`${row.id}-quantity`}
                        type="text"
                        inputMode="decimal"
                        value={draft.quantity}
                        onChange={(event) =>
                          updateFieldDraft(row.id, {
                            quantity: event.target.value,
                          })
                        }
                        onBlur={() => commitQuantity(row.id)}
                        disabled={isBusy}
                        className="min-h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${row.id}-price`}>Costo unitario</Label>
                      <Input
                        id={`${row.id}-price`}
                        type="text"
                        inputMode="decimal"
                        value={draft.unitPrice}
                        onChange={(event) =>
                          updateFieldDraft(row.id, {
                            unitPrice: event.target.value,
                          })
                        }
                        onBlur={() => commitUnitPrice(row.id)}
                        disabled={isBusy}
                        placeholder="0,00"
                        spellCheck={false}
                        className="min-h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${row.id}-margin`}>Margen (%)</Label>
                      <Input
                        id={`${row.id}-margin`}
                        type="text"
                        inputMode="decimal"
                        value={draft.margin}
                        onChange={(event) =>
                          updateFieldDraft(row.id, {
                            margin: event.target.value,
                          })
                        }
                        onBlur={() => commitMargin(row.id)}
                        disabled={isBusy}
                        placeholder="0"
                        className="min-h-12"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)] px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Precio de venta
                      {row.marginPct > 0 ? ` (costo + ${row.marginPct}%)` : ""}
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {formatCurrencyAmount(salePrice, currency)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${row.id}-description`}>Detalle opcional</Label>
                    <textarea
                      id={`${row.id}-description`}
                      rows={2}
                      value={row.description ?? ""}
                      onChange={(event) =>
                        updateRow(row.id, {
                          description: event.target.value || null,
                        })
                      }
                      disabled={isBusy}
                      className={textareaClassName}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {status ? (
          <p className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {status}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row">
          <Button
            type="button"
            onClick={handleApplyToQuotation}
            disabled={disabled || isApplyingQuotation || rows.length === 0}
            className="min-h-12"
          >
            {isApplyingQuotation
              ? "Agregando a la cotización..."
              : `Agregar a la cotización (${quotationSelection.length})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveToCatalog}
            disabled={disabled || isSavingCatalog || rows.length === 0}
            className="min-h-12 bg-background/75"
          >
            {isSavingCatalog
              ? "Guardando en catálogo..."
              : `Guardar en catálogo (${catalogSelection.length})`}
          </Button>
        </div>

        {discardedSelection.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {discardedSelection.length} ítem(s) marcados para descartar — no se
            van a guardar en ningún lado.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
