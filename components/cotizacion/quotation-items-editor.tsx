"use client";

import { useMemo, useState } from "react";
import { Mic, PackagePlus, Plus, Search, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSpeechInput } from "@/hooks/use-speech-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { calculateQuotationLineTotal } from "@/lib/quotation-calculations";
import { formatCurrencyAmount } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { CatalogItem } from "@/types";

export type QuotationEditorItem = {
  id: string;
  source: "manual" | "catalog" | "invoice";
  catalogItemId: string | null;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type QuotationItemsEditorProps = {
  items: QuotationEditorItem[];
  catalogItems: CatalogItem[];
  currency: string | null;
  disabled?: boolean;
  onAddManualItem: () => void;
  onAddCatalogItem: (item: CatalogItem) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (
    itemId: string,
    updates: Partial<QuotationEditorItem>,
  ) => void;
};

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function matchesCatalogItem(item: CatalogItem, query: string) {
  const searchTarget = [
    item.name,
    item.description ?? "",
    item.category ?? "",
    item.unit,
  ]
    .join(" ")
    .toLowerCase();

  return searchTarget.includes(query);
}

function parseDecimalValue(rawValue: string) {
  const compactValue = rawValue.trim().replace(/\s+/g, "");

  if (!compactValue) {
    return 0;
  }

  // Keep only digits and possible decimal/thousands separators.
  const sanitizedValue = compactValue.replace(/[^\d,.-]/g, "");
  const lastCommaIndex = sanitizedValue.lastIndexOf(",");
  const lastDotIndex = sanitizedValue.lastIndexOf(".");

  let normalizedValue = sanitizedValue;

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
    normalizedValue = sanitizedValue
      .replace(thousandsSeparator, "")
      .replace(decimalSeparator, ".");
  } else if (lastCommaIndex !== -1) {
    const parts = sanitizedValue.split(",");
    normalizedValue =
      parts.length > 2
        ? `${parts.slice(0, -1).join("")}.${parts[parts.length - 1]}`
        : sanitizedValue.replace(",", ".");
  }

  // Allow incomplete decimals while typing (e.g. "123."), but no thousands
  // separators left after normalization.
  if (!/^\d+(?:\.\d*)?$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function ConceptFieldWithVoice({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
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
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ej. Colocación de cañería 2 pulgadas"
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

export function QuotationItemsEditor({
  items,
  catalogItems,
  currency,
  disabled = false,
  onAddManualItem,
  onAddCatalogItem,
  onRemoveItem,
  onUpdateItem,
}: QuotationItemsEditorProps) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  const filteredCatalogItems = useMemo(() => {
    const normalizedSearch = catalogSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return catalogItems;
    }

    return catalogItems.filter((item) =>
      matchesCatalogItem(item, normalizedSearch),
    );
  }, [catalogItems, catalogSearch]);

  function getSourceLabel(source: QuotationEditorItem["source"]) {
    if (source === "catalog") {
      return "Desde catálogo";
    }

    if (source === "invoice") {
      return "Desde factura";
    }

    return "Manual";
  }

  return (
    <>
      <Card className="border-token bg-surface shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Ítems de la cotización</CardTitle>
              <CardDescription>
                Agrega conceptos manuales o importa ítems del catálogo como una
                copia editable.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="border-token bg-background"
                onClick={onAddManualItem}
                disabled={disabled}
              >
                <Plus className="mr-2 h-4 w-4" />
                Item manual
              </Button>
              <Button
                type="button"
                onClick={() => setCatalogOpen(true)}
                disabled={disabled}
              >
                <PackagePlus className="mr-2 h-4 w-4" />
                Agregar desde mis productos
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-token bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
              Carga tu primer ítem para ver el resumen en vivo y guardar el
              borrador.
            </div>
          ) : (
            <div className="grid gap-4">
              {items.map((item, index) => {
                const lineTotal = calculateQuotationLineTotal(
                  item.quantity,
                  item.unitPrice,
                );

                return (
                  <div
                    key={item.id}
                    className="space-y-4 rounded-xl border border-token/80 bg-background/60 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-token/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            {getSourceLabel(item.source)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Item {index + 1}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Edita concepto, detalle, cantidad, unidad y precio antes
                          de guardar.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Total de línea</p>
                          <p className="text-lg font-semibold text-foreground">
                            {formatCurrencyAmount(lineTotal, currency)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onRemoveItem(item.id)}
                          disabled={disabled}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Quitar
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                      <div className="space-y-2">
                        <Label htmlFor={`${item.id}-name`}>Concepto</Label>
                        <ConceptFieldWithVoice
                          id={`${item.id}-name`}
                          value={item.name}
                          onChange={(name) => onUpdateItem(item.id, { name })}
                          disabled={disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${item.id}-unit`}>Unidad</Label>
                        <Input
                          id={`${item.id}-unit`}
                          value={item.unit}
                          onChange={(event) =>
                            onUpdateItem(item.id, { unit: event.target.value })
                          }
                          placeholder="unidad, m2, bolsa"
                          disabled={disabled}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`${item.id}-quantity`}>Cantidad</Label>
                        <Input
                          id={`${item.id}-quantity`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(event) =>
                            onUpdateItem(item.id, {
                              quantity: parseDecimalValue(event.target.value) ?? 0,
                            })
                          }
                          disabled={disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${item.id}-price`}>Precio unitario</Label>
                        <Input
                          id={`${item.id}-price`}
                          type="number"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) => {
                            const parsedValue = Number.parseFloat(event.target.value);
                            onUpdateItem(item.id, {
                              unitPrice: Number.isFinite(parsedValue) ? parsedValue : 0,
                            });
                          }}
                          disabled={disabled}
                          placeholder="0.00"
                          className="min-h-12"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${item.id}-description`}>
                        Detalle opcional
                      </Label>
                      <textarea
                        id={`${item.id}-description`}
                        rows={3}
                        value={item.description}
                        onChange={(event) =>
                          onUpdateItem(item.id, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Notas, terminaciones, alcance o cualquier detalle adicional"
                        disabled={disabled}
                        className={textareaClassName}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={catalogOpen} onOpenChange={setCatalogOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto border-token bg-surface"
        >
          <SheetHeader className="space-y-2">
            <SheetTitle>Agregar desde mis productos</SheetTitle>
            <SheetDescription>
              Elegí un producto para sumarlo a la cotización. Podés editarlo sin
              cambiar tu catálogo original.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                placeholder="Buscar por nombre, categoría, descripción o unidad"
                className="pl-9"
              />
            </div>

            {filteredCatalogItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-token bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                {catalogSearch.trim()
                  ? "No encontramos ítems para esa búsqueda."
                  : "Todavía no hay ítems en tu catálogo para importar."}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredCatalogItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-token/80 bg-background/60 p-4"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.description?.trim() ||
                          item.category?.trim() ||
                          "Sin detalle adicional"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span>Unidad: {item.unit}</span>
                      <span>{formatCurrencyAmount(item.price, currency)}</span>
                    </div>

                    <Button
                      type="button"
                      onClick={() => {
                        onAddCatalogItem(item);
                        setCatalogOpen(false);
                      }}
                      disabled={disabled}
                    >
                      Agregar a la cotización
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
