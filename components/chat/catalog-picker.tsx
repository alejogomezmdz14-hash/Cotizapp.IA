"use client";

import { useState } from "react";
import { Check, Minus, PencilLine, Plus } from "lucide-react";
import type { CatalogPickerItem, ChatSuggestedQuotationItem } from "@/types";
import { formatCurrencyAmount } from "@/lib/formatting";

type SelectedItem = {
  item: CatalogPickerItem;
  quantity: number;
};

type CatalogPickerProps = {
  items: CatalogPickerItem[];
  clientName: string;
  disabled?: boolean;
  initialItems?: ChatSuggestedQuotationItem[];
  onConfirm: (selectedItems: ChatSuggestedQuotationItem[]) => void;
  onManualItem?: () => void;
};

export function CatalogPicker({
  items,
  clientName,
  disabled = false,
  initialItems,
  onConfirm,
  onManualItem,
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

  const selectedList = Array.from(selected.values());
  const subtotal = selectedList.reduce(
    (sum, entry) => sum + entry.item.price * entry.quantity,
    0,
  );

  function handleConfirm() {
    if (disabled || selectedList.length === 0) {
      return;
    }

    onConfirm(
      selectedList.map((entry) => ({
        catalogItemId: entry.item.id,
        name: entry.item.name,
        description: entry.item.description,
        quantity: entry.quantity,
        unit: entry.item.unit,
        unitPrice: entry.item.price,
      })),
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-[#2A2D3E] p-4">
        <p className="text-sm text-[#8B8FA8]">
          Todavía no tenés ítems en tu catálogo.
        </p>
        {onManualItem && (
          <button
            type="button"
            onClick={onManualItem}
            className="mt-3 flex items-center gap-2 rounded-lg bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#00E5A0] transition hover:bg-[#222536]"
          >
            <PencilLine className="h-4 w-4" />
            Agregar ítem manual
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
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

      {selectedList.length > 0 && (
        <div className="rounded-xl border border-[#2A2D3E] bg-[#1A1D27] px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#8B8FA8]">
              {selectedList.length} ítem{selectedList.length > 1 ? "s" : ""}
            </p>
            <p className="text-base font-bold text-white">
              {formatCurrencyAmount(subtotal, "ARS")}
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={disabled || selectedList.length === 0}
        onClick={handleConfirm}
        className="min-h-[52px] w-full rounded-xl bg-[#00E5A0] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#00C984] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {selectedList.length === 0
          ? "Seleccioná al menos un ítem"
          : `Confirmar ${selectedList.length} ítem${selectedList.length > 1 ? "s" : ""}`}
      </button>

      {onManualItem && (
        <button
          type="button"
          disabled={disabled}
          onClick={onManualItem}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#2A2D3E] px-4 py-2 text-sm text-[#8B8FA8] transition hover:border-[#00E5A0]/40 hover:text-white"
        >
          <PencilLine className="h-4 w-4" />
          Agregar ítem manual
        </button>
      )}
    </div>
  );
}
