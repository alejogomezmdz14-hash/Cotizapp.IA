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
import {
  createInvoiceReviewItems,
  markSavedCatalogRows,
  removeAppliedQuotationRows,
  toInvoiceDraft,
  updateInvoiceReviewDestination,
  type EditableInvoiceReviewItem,
  type InvoiceReviewDestination,
} from "@/lib/invoice-scan/review";
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

function parseDecimalValue(rawValue: string) {
  const normalizedValue = rawValue.trim().replace(",", ".");
  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getDestinationCardClassName(destination: InvoiceReviewDestination) {
  switch (destination) {
    case "quotation":
      return "border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)]";
    case "catalog":
      return "border-token/80 bg-background/70";
    case "discard":
      return "border-token/70 bg-background/45";
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
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const [isApplyingQuotation, setIsApplyingQuotation] = useState(false);

  useEffect(() => {
    setRows(createInvoiceReviewItems(result));
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

  function updateRow(
    rowId: string,
    updates: Partial<EditableInvoiceReviewItem>,
  ) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, ...updates } : row)),
    );
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
      setError("Selecciona al menos un item para agregar a la cotizacion.");
      return;
    }

    const confirmed = window.confirm(
      `Se agregaran ${quotationSelection.length} item(s) editados a la cotizacion actual. Puedes seguir ajustandolos despues. Deseas continuar?`,
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
      setStatus("Items agregados a la cotizacion actual.");
    } finally {
      setIsApplyingQuotation(false);
    }
  }

  async function handleSaveToCatalog() {
    if (catalogSelection.length === 0) {
      setError("Selecciona al menos un item para guardar en el catalogo.");
      return;
    }

    const confirmed = window.confirm(
      `Esto guardara ${catalogSelection.length} item(s) en tu catalogo. Esta accion persiste los datos detectados por AI y solo deberia hacerse despues de revisarlos. Deseas continuar?`,
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
          ? `Se guardaron ${result.createdCount} item(s) en el catalogo. Se omitieron ${result.skippedCount} fila(s) invalida(s).`
          : result.createdCount === 1
            ? "1 item guardado en el catalogo."
            : `${result.createdCount} items guardados en el catalogo.`,
      );
      router.refresh();
    } catch (catalogError) {
      setError(
        catalogError instanceof Error && catalogError.message.trim()
          ? catalogError.message
          : "No se pudieron guardar los items seleccionados.",
      );
    } finally {
      setIsSavingCatalog(false);
    }
  }

  if (!result) {
    return (
      <Card className="shell-panel overflow-hidden shadow-none">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Revision del escaneo</CardTitle>
          <CardDescription className="leading-6">
            Cuando el AI termine de leer tu factura, aqui podras editar cada
            renglon y decidir si va a la cotizacion actual, al catalogo o se
            descarta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.75rem] border border-dashed border-token/80 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
            Carga una factura para abrir la revision editable y decidir destino por
            destino antes de persistir nada.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shell-panel overflow-hidden shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-accent-token">
              <FileSpreadsheet className="h-4 w-4" />
              Resultado editable
            </div>
            <CardTitle className="text-xl">Revisar items detectados</CardTitle>
            <CardDescription>
              Nada se guarda automaticamente. Edita los datos, marca el destino
              exclusivo de cada item y confirma la accion correspondiente.
            </CardDescription>
          </div>

          <Button
            type="button"
            variant="outline"
            className="bg-background/75"
            onClick={onClear}
            disabled={disabled || isSavingCatalog || isApplyingQuotation}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Limpiar revision
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Items detectados
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {result.items.length}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Para cotizacion
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {quotationSelection.length}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Para catalogo
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {catalogSelection.length}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Para descarte
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {discardedSelection.length}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Archivo
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {fileName ?? "Factura sin nombre"}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Proveedor
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {result.supplierName ?? "No detectado"}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Numero
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {result.invoiceNumber ?? "No detectado"}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Moneda
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {result.currency ?? "No detectada"}
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
            <p className="font-medium">Advertencias detectadas</p>
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
              El resultado ya esta listo para revisar y confirmar.
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-token/80 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
            {result.items.length === 0
              ? "No encontramos items claros en esta factura. Puedes intentar con otra imagen mas nitida o cargar los conceptos manualmente."
              : "No quedan items pendientes en esta revision. Puedes limpiar la revision o subir otra factura."}
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className={`space-y-4 rounded-[1.75rem] border p-4 ${getDestinationCardClassName(row.destination)}`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Item detectado {index + 1}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Corrige nombre, detalle, cantidad, unidad y precio antes de
                      confirmar cualquier accion.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-full border border-token/80 bg-background/70 px-3 py-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name={`${row.id}-destination`}
                        checked={row.destination === "quotation"}
                        onChange={(event) =>
                          event.target.checked
                            ? handleDestinationChange(row.id, "quotation")
                            : undefined
                        }
                        disabled={disabled || isSavingCatalog || isApplyingQuotation}
                        className="h-4 w-4 rounded border-input"
                      />
                      Agregar a esta cotizacion
                    </label>
                    <label className="flex items-center gap-2 rounded-full border border-token/80 bg-background/70 px-3 py-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name={`${row.id}-destination`}
                        checked={row.destination === "catalog"}
                        onChange={(event) =>
                          event.target.checked
                            ? handleDestinationChange(row.id, "catalog")
                            : undefined
                        }
                        disabled={disabled || isSavingCatalog || isApplyingQuotation}
                        className="h-4 w-4 rounded border-input"
                      />
                      Guardar en catalogo
                    </label>
                    <label className="flex items-center gap-2 rounded-full border border-token/80 bg-background/70 px-3 py-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name={`${row.id}-destination`}
                        checked={row.destination === "discard"}
                        onChange={(event) =>
                          event.target.checked
                            ? handleDestinationChange(row.id, "discard")
                            : undefined
                        }
                        disabled={disabled || isSavingCatalog || isApplyingQuotation}
                        className="h-4 w-4 rounded border-input"
                      />
                      Descartar
                    </label>
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
                      disabled={disabled || isSavingCatalog || isApplyingQuotation}
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
                      disabled={disabled || isSavingCatalog || isApplyingQuotation}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${row.id}-quantity`}>Cantidad</Label>
                    <Input
                      id={`${row.id}-quantity`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.id, {
                          quantity: parseDecimalValue(event.target.value),
                        })
                      }
                      disabled={disabled || isSavingCatalog || isApplyingQuotation}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${row.id}-price`}>Precio unitario</Label>
                    <Input
                      id={`${row.id}-price`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(event) =>
                        updateRow(row.id, {
                          unitPrice: parseDecimalValue(event.target.value),
                        })
                      }
                      disabled={disabled || isSavingCatalog || isApplyingQuotation}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${row.id}-description`}>Detalle opcional</Label>
                  <textarea
                    id={`${row.id}-description`}
                    rows={3}
                    value={row.description ?? ""}
                    onChange={(event) =>
                      updateRow(row.id, {
                        description: event.target.value || null,
                      })
                    }
                    disabled={disabled || isSavingCatalog || isApplyingQuotation}
                    className={textareaClassName}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
          <p>
            Seleccionados para cotizacion:{" "}
            <span className="font-medium text-foreground">
              {quotationSelection.length}
            </span>
          </p>
          <p>
            Seleccionados para catalogo:{" "}
            <span className="font-medium text-foreground">
              {catalogSelection.length}
            </span>
          </p>
          <p>
            Marcados para descarte:{" "}
            <span className="font-medium text-foreground">
              {discardedSelection.length}
            </span>
          </p>
        </div>

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
          >
            {isApplyingQuotation
              ? "Agregando a la cotizacion..."
              : "Agregar seleccionados a la cotizacion"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveToCatalog}
            disabled={disabled || isSavingCatalog || rows.length === 0}
            className="bg-background/75"
          >
            {isSavingCatalog
              ? "Guardando en catalogo..."
              : "Guardar seleccionados en catalogo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
