"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Plus, Search, Trash2 } from "lucide-react";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { calculateQuotationLineTotal } from "@/lib/quotation-calculations";
import { formatCurrencyAmount } from "@/lib/formatting";
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
  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
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
      return "Desde catalogo";
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
              <CardTitle className="text-xl">Items de la cotizacion</CardTitle>
              <CardDescription>
                Agrega conceptos manuales o importa items del catalogo como una
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
                Importar catalogo
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-token bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
              Carga tu primer item para ver el resumen en vivo y guardar el
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
                          <p className="text-sm text-muted-foreground">Total de linea</p>
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
                        <Input
                          id={`${item.id}-name`}
                          value={item.name}
                          onChange={(event) =>
                            onUpdateItem(item.id, { name: event.target.value })
                          }
                          placeholder="Ej. Cemento portland x 50 kg"
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
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(event) =>
                            onUpdateItem(item.id, {
                              quantity: parseDecimalValue(event.target.value),
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
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(event) =>
                            onUpdateItem(item.id, {
                              unitPrice: parseDecimalValue(event.target.value),
                            })
                          }
                          disabled={disabled}
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
            <SheetTitle>Importar desde catalogo</SheetTitle>
            <SheetDescription>
              Elige un item para copiarlo a la cotizacion y ajustarlo sin tocar
              tu catalogo original.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                placeholder="Buscar por nombre, categoria, descripcion o unidad"
                className="pl-9"
              />
            </div>

            {filteredCatalogItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-token bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
                {catalogSearch.trim()
                  ? "No encontramos items para esa busqueda."
                  : "Todavia no hay items en tu catalogo para importar."}
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
                      Agregar a la cotizacion
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
