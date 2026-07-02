"use client";

import { useState } from "react";
import { Check, Minus, PencilLine, Plus, X } from "lucide-react";
import type { CatalogPickerItem, ChatSuggestedQuotationItem } from "@/types";
import { DEFAULT_CATALOG_UNIT } from "@/lib/catalog-units";
import { formatCurrencyAmount } from "@/lib/formatting";

type SelectedItem = {
  item: CatalogPickerItem;
  quantity: number;
};

type ManualItemEntry = {
  key: number;
  item: ChatSuggestedQuotationItem;
};

type CatalogPickerProps = {
  items: CatalogPickerItem[];
  clientName: string;
  disabled?: boolean;
  initialItems?: ChatSuggestedQuotationItem[];
  onConfirm: (selectedItems: ChatSuggestedQuotationItem[]) => void;
};

// Clave estable para las filas de ítems manuales (no tienen id propio).
let manualItemKeyCounter = 0;

function nextManualItemKey() {
  manualItemKeyCounter += 1;
  return manualItemKeyCounter;
}

function parseAmountInput(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function CatalogPicker({
  items,
  clientName,
  disabled = false,
  initialItems,
  onConfirm,
}: CatalogPickerProps) {
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(() => {
    const initial = new Map<string, SelectedItem>();

    for (const draftItem of initialItems ?? []) {
      if (!draftItem.catalogItemId) {
        continue;
      }
      const catalogItem = items.find(
        (item) => item.id === draftItem.catalogItemId,
      );
      if (catalogItem) {
        initial.set(catalogItem.id, {
          item: catalogItem,
          quantity: draftItem.quantity,
        });
      }
    }

    return initial;
  });
  // Ítems sin catálogo (dictados a la IA o cargados a mano) preseleccionados.
  const [manualItems, setManualItems] = useState<ManualItemEntry[]>(() =>
    (initialItems ?? [])
      .filter(
        (draftItem) =>
          !draftItem.catalogItemId ||
          !items.some((item) => item.id === draftItem.catalogItemId),
      )
      .map((draftItem) => ({
        key: nextManualItemKey(),
        item: { ...draftItem, catalogItemId: null },
      })),
  );
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("1");
  const [manualPrice, setManualPrice] = useState("");

  function toggleItem(item: CatalogPickerItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, { item, quantity: 1 });
      }
      return next;
    });
  }

  function adjustQuantity(itemId: string, delta: number) {
    setSelected((prev) => {
      const entry = prev.get(itemId);
      if (!entry) {
        return prev;
      }
      const next = new Map(prev);
      next.set(itemId, {
        ...entry,
        quantity: Math.max(1, entry.quantity + delta),
      });
      return next;
    });
  }

  function adjustManualQuantity(key: number, delta: number) {
    setManualItems((prev) =>
      prev.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              item: {
                ...entry.item,
                quantity: Math.max(1, entry.item.quantity + delta),
              },
            }
          : entry,
      ),
    );
  }

  function removeManualItem(key: number) {
    setManualItems((prev) => prev.filter((entry) => entry.key !== key));
  }

  const manualNameValue = manualName.trim();
  const manualQuantityValue = parseAmountInput(manualQuantity);
  const manualPriceValue = parseAmountInput(manualPrice);
  const canAddManualItem =
    manualNameValue.length > 0 &&
    manualQuantityValue !== null &&
    manualQuantityValue > 0 &&
    manualPriceValue !== null &&
    manualPriceValue >= 0;

  function handleAddManualItem() {
    const name = manualName.trim();
    const quantity = parseAmountInput(manualQuantity);
    const unitPrice = parseAmountInput(manualPrice);

    if (
      disabled ||
      !name ||
      quantity === null ||
      quantity <= 0 ||
      unitPrice === null ||
      unitPrice < 0
    ) {
      return;
    }

    setManualItems((prev) => [
      ...prev,
      {
        key: nextManualItemKey(),
        item: {
          catalogItemId: null,
          name,
          description: null,
          quantity,
          unit: DEFAULT_CATALOG_UNIT,
          unitPrice,
        },
      },
    ]);
    setManualName("");
    setManualQuantity("1");
    setManualPrice("");
    setShowManualForm(false);
  }

  const selectedList = Array.from(selected.values());
  const totalCount = selectedList.length + manualItems.length;
  const subtotal =
    selectedList.reduce(
      (sum, entry) => sum + entry.item.price * entry.quantity,
      0,
    ) +
    manualItems.reduce(
      (sum, entry) => sum + entry.item.unitPrice * entry.item.quantity,
      0,
    );

  function handleConfirm() {
    if (disabled || totalCount === 0) {
      return;
    }

    onConfirm([
      ...selectedList.map((entry) => ({
        catalogItemId: entry.item.id,
        name: entry.item.name,
        description: entry.item.description,
        quantity: entry.quantity,
        unit: entry.item.unit,
        unitPrice: entry.item.price,
      })),
      ...manualItems.map((entry) => entry.item),
    ]);
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2D3E] p-4">
          <p className="text-sm text-[#8B8FA8]">
            Todavía no tenés ítems en tu catálogo. Agregá lo que vas a cobrar
            como ítem manual acá abajo.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#8B8FA8]">
            Seleccioná los ítems para la cotización de{" "}
            <span className="font-medium text-white">{clientName}</span>
          </p>

          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto">
            {items.map((item) => {
              const entry = selected.get(item.id);
              const isSelected = Boolean(entry);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border transition-all ${
                    isSelected
                      ? "border-[#00E5A0] bg-[#00E5A0]/5"
                      : "border-[#2A2D3E] bg-[#0F1117]"
                  }`}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleItem(item)}
                    className="flex min-h-[56px] w-full items-center gap-3 px-3 py-3 text-left active:opacity-80 disabled:opacity-50"
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isSelected
                          ? "border-[#00E5A0] bg-[#00E5A0]"
                          : "border-[#2A2D3E]"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-black" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {item.name}
                      </p>
                      {item.category && (
                        <p className="text-xs text-[#8B8FA8]">{item.category}</p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[#00E5A0]">
                      {formatCurrencyAmount(item.price, "ARS")}/{item.unit}
                    </p>
                  </button>

                  {entry && (
                    <div className="flex items-center justify-between border-t border-[#2A2D3E] px-3 py-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => adjustQuantity(item.id, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1D27] text-white transition hover:bg-[#222536] active:opacity-80"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-white">
                          {entry.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => adjustQuantity(item.id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1D27] text-white transition hover:bg-[#222536] active:opacity-80"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {formatCurrencyAmount(item.price * entry.quantity, "ARS")}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {manualItems.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-[#8B8FA8]">Ítems manuales</p>
          {manualItems.map((entry) => (
            <div
              key={entry.key}
              className="rounded-xl border border-[#00E5A0] bg-[#00E5A0]/5"
            >
              <div className="flex min-h-[56px] items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {entry.item.name}
                  </p>
                  <p className="text-xs text-[#8B8FA8]">Ítem manual</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-[#00E5A0]">
                  {formatCurrencyAmount(entry.item.unitPrice, "ARS")}/
                  {entry.item.unit}
                </p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeManualItem(entry.key)}
                  aria-label={`Quitar ${entry.item.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1A1D27] text-[#8B8FA8] transition hover:bg-[#222536] hover:text-white active:opacity-80 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-[#2A2D3E] px-3 py-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => adjustManualQuantity(entry.key, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1D27] text-white transition hover:bg-[#222536] active:opacity-80"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-white">
                    {entry.item.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => adjustManualQuantity(entry.key, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1D27] text-white transition hover:bg-[#222536] active:opacity-80"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-white">
                  {formatCurrencyAmount(
                    entry.item.unitPrice * entry.item.quantity,
                    "ARS",
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showManualForm ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[#2A2D3E] bg-[#1A1D27] p-3">
          <div className="space-y-1.5">
            <label
              htmlFor="chat-manual-item-name"
              className="text-sm font-medium text-white"
            >
              ¿Qué vas a cobrar?
            </label>
            <input
              id="chat-manual-item-name"
              type="text"
              placeholder="Ej: Mano de obra"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              disabled={disabled}
              className="min-h-12 w-full rounded-xl border border-[#2A2D3E] bg-[#0F1117] px-3 text-sm text-white placeholder:text-[#8B8FA8] focus:border-[#00E5A0] focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="chat-manual-item-quantity"
                className="text-sm font-medium text-white"
              >
                Cantidad
              </label>
              <input
                id="chat-manual-item-quantity"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                placeholder="Ej: 3"
                value={manualQuantity}
                onChange={(event) => setManualQuantity(event.target.value)}
                disabled={disabled}
                className="min-h-12 w-full rounded-xl border border-[#2A2D3E] bg-[#0F1117] px-3 text-sm text-white placeholder:text-[#8B8FA8] focus:border-[#00E5A0] focus:outline-none disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="chat-manual-item-price"
                className="text-sm font-medium text-white"
              >
                Precio unitario
              </label>
              <input
                id="chat-manual-item-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Ej: 8500"
                value={manualPrice}
                onChange={(event) => setManualPrice(event.target.value)}
                disabled={disabled}
                className="min-h-12 w-full rounded-xl border border-[#2A2D3E] bg-[#0F1117] px-3 text-sm text-white placeholder:text-[#8B8FA8] focus:border-[#00E5A0] focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || !canAddManualItem}
              onClick={handleAddManualItem}
              className="min-h-[44px] flex-1 rounded-xl bg-[#00E5A0] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#00C984] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Agregar
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowManualForm(false)}
              className="min-h-[44px] flex-1 rounded-xl border border-[#2A2D3E] px-4 py-2 text-sm font-medium text-[#8B8FA8] transition hover:border-[#00E5A0]/40 hover:text-white disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowManualForm(true)}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#2A2D3E] px-4 py-2 text-sm text-[#8B8FA8] transition hover:border-[#00E5A0]/40 hover:text-white disabled:opacity-50"
        >
          <PencilLine className="h-4 w-4" />
          Agregar ítem manual
        </button>
      )}

      {totalCount > 0 && (
        <div className="rounded-xl border border-[#2A2D3E] bg-[#1A1D27] px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#8B8FA8]">
              {totalCount} ítem{totalCount > 1 ? "s" : ""}
            </p>
            <p className="text-base font-bold text-white">
              {formatCurrencyAmount(subtotal, "ARS")}
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={disabled || totalCount === 0}
        onClick={handleConfirm}
        className="min-h-[52px] w-full rounded-xl bg-[#00E5A0] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#00C984] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {totalCount === 0
          ? "Agregá al menos un ítem"
          : `Confirmar ${totalCount} ítem${totalCount > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
