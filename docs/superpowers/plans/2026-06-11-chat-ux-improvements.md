# Chat UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the chat quotation creation flow with interactive pickers (CatalogPicker, enhanced ClientPicker, CotizacionPreview, CotizacionCreada) and add SuggestionChips for quick prompts.

**Architecture:** The existing chat uses JSON mode (not OpenAI tool_calls) with a confirm-based save flow — the AI proposes a `suggestedAction`, the user confirms, and the server action saves it. The plan extends this with UI components that make the quotation creation flow fully interactive without rewriting the AI backend. The `ChatUiHint` discriminated union is extended with `catalog_picker`; after a client is selected the chat-shell fetches catalog items client-side and injects the CatalogPicker directly, bypassing the AI for item selection.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, Zustand, shadcn/ui

> **IMPORTANT — Auth is Clerk + Supabase DB.** `requireUser()` from `@/lib/profile` resolves the Clerk user to the profile UUID via `ensureProfileForClerkUser()` — `user.id` is ALWAYS the Supabase profile UUID, never the Clerk ID. The Clerk→UUID mapping is centralized; never do it manually in actions or routes. RLS uses `current_profile_id()` (Clerk JWT), not `auth.uid()`.

> **CONFIRMED WORKING — Do not touch:**
> - `app/api/ai/chat/route.ts` — chat route is correct, uses JSON mode, parallel queries
> - `lib/chat/chat-tools.ts` — `createCotizacion` saves correctly to DB
> - `app/actions/ai.ts` — `confirmDraftQuotationSuggestionAction` works
> - `app/api/quotations/[id]/pdf/route.ts` — has `runtime = 'nodejs'`, correct headers
> - `app/api/uploads/logo/route.ts` — delegates correctly via server action
> - TypeScript: zero errors. Build: passing.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `types/index.ts` | Add `CatalogPickerItem`, extend `ChatUiHint` to discriminated union |
| Modify | `app/actions/ai.ts` | Add `getCatalogItemsAction()` server action |
| Modify | `components/chat/client-selector-message.tsx` | Enhance: search, color avatars, sticky confirm, empty state |
| Create | `components/chat/catalog-picker.tsx` | Item selection with quantity controls, subtotals, confirm |
| Create | `components/chat/cotizacion-preview.tsx` | Structured preview card before saving |
| Create | `components/chat/cotizacion-creada.tsx` | Success card with View / WhatsApp / New actions |
| Create | `components/chat/suggestion-chips.tsx` | Contextual prompt chips based on chat phase |
| Modify | `components/chat/chat-message-list.tsx` | Render CatalogPicker, CotizacionPreview, CotizacionCreada |
| Modify | `components/chat/chat-shell.tsx` | Add quotation flow state, inject catalog_picker, wire all components |

---

## Task 1 — Extend Types

**Files:**
- Modify: `types/index.ts` (lines 357–373, the `ChatUiHint` and `ChatReplyPayload` area)

- [ ] **Step 1: Add `CatalogPickerItem` type and extend `ChatUiHint` to a discriminated union**

In `types/index.ts`, replace:
```typescript
export type ChatUiHint = {
  type: "client_selector";
  clients: ChatClientListItem[];
};
```

With:
```typescript
export type CatalogPickerItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string | null;
  description: string | null;
};

export type ChatUiHint =
  | {
      type: "client_selector";
      clients: ChatClientListItem[];
    }
  | {
      type: "catalog_picker";
      items: CatalogPickerItem[];
      clientId: string;
      clientName: string;
    };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add CatalogPickerItem, extend ChatUiHint to discriminated union"
```

---

## Task 2 — Add getCatalogItemsAction server action

**Files:**
- Modify: `app/actions/ai.ts`

- [ ] **Step 1: Add the server action**

In `app/actions/ai.ts`, after the existing imports at the top, add `CatalogPickerItem` to the type imports:
```typescript
import type {
  CatalogPickerItem,
  ChatCatalogPriceUpdateAction,
  ChatDraftQuotationCreateAction,
  ChatExpenseCreateAction,
  ChatSuggestedQuotationItem,
} from "@/types";
```

Then add this export at the end of the file:
```typescript
export async function getCatalogItemsAction(): Promise<CatalogPickerItem[]> {
  const user = await requireUser();
  const { getCatalogItems } = await import("@/lib/catalog");
  const items = await getCatalogItems(user.id);

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    unit: item.unit,
    category: item.category,
    description: item.description,
  }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add app/actions/ai.ts
git commit -m "feat(actions): add getCatalogItemsAction for chat catalog picker"
```

---

## Task 3 — Enhanced ClientSelectorMessage

**Files:**
- Modify: `components/chat/client-selector-message.tsx`

Current component shows a basic list of buttons. Upgrade to match the spec: color-coded avatars, search when >4 clients, sticky confirm button, empty state.

- [ ] **Step 1: Rewrite the component**

Replace the entire content of `components/chat/client-selector-message.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import type { ChatClientListItem } from "@/types";

type ClientSelectorMessageProps = {
  clients: ChatClientListItem[];
  disabled?: boolean;
  onSelect: (client: ChatClientListItem) => void;
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
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length] ?? "bg-[#00E5A0]";
}

export function ClientSelectorMessage({
  clients,
  disabled = false,
  onSelect,
}: ClientSelectorMessageProps) {
  const [selected, setSelected] = useState<ChatClientListItem | null>(null);
  const [search, setSearch] = useState("");

  const showSearch = clients.length > 4;
  const filtered = showSearch
    ? clients.filter((c) =>
        c.nombre.toLowerCase().includes(search.toLowerCase()),
      )
    : clients;

  function handleSelect(client: ChatClientListItem) {
    setSelected(client);
  }

  function handleConfirm() {
    if (selected && !disabled) {
      onSelect(selected);
    }
  }

  if (clients.length === 0) {
    return (
      <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-dashed border-[#2A2D3E] p-4">
        <p className="text-sm text-[#8B8FA8]">
          Todavía no tenés clientes cargados.
        </p>
        <a
          href="/clientes"
          className="flex items-center gap-2 rounded-lg bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#00E5A0] transition hover:bg-[#222536]"
        >
          <UserPlus className="h-4 w-4" />
          Crear primer cliente
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {showSearch && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full rounded-xl border border-[#2A2D3E] bg-[#0F1117] px-3 py-2 text-sm text-white placeholder:text-[#8B8FA8] focus:border-[#00E5A0] focus:outline-none"
        />
      )}

      <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">
        {filtered.map((client) => {
          const isSelected = selected?.id === client.id;
          return (
            <button
              key={client.id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(client)}
              className={`flex min-h-[64px] items-center gap-3 rounded-xl border p-3 text-left transition-all active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? "border-[#00E5A0] bg-[#00E5A0]/10"
                  : "border-[#2A2D3E] bg-[#0F1117] hover:border-[#00E5A0]/40"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${getAvatarColor(client.nombre)}`}
              >
                {client.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {client.nombre}
                </p>
                {client.telefono && (
                  <p className="mt-0.5 text-xs text-[#8B8FA8]">
                    {client.telefono}
                  </p>
                )}
              </div>
              {isSelected && (
                <Check className="h-4 w-4 shrink-0 text-[#00E5A0]" />
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-[#8B8FA8]">
            Sin resultados para &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

      {selected && (
        <button
          type="button"
          disabled={disabled}
          onClick={handleConfirm}
          className="mt-1 min-h-[52px] w-full rounded-xl bg-[#00E5A0] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#00C984] active:opacity-80 disabled:opacity-50"
        >
          Elegir a {selected.nombre}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/chat/client-selector-message.tsx
git commit -m "feat(chat): enhance ClientSelectorMessage with search, color avatars, sticky confirm"
```

---

## Task 4 — CatalogPicker component

**Files:**
- Create: `components/chat/catalog-picker.tsx`

- [ ] **Step 1: Create the component**

Create `components/chat/catalog-picker.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Minus, Plus, CheckCircle2, PencilLine } from "lucide-react";
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
  onConfirm: (selectedItems: ChatSuggestedQuotationItem[]) => void;
  onManualItem?: () => void;
};

export function CatalogPicker({
  items,
  clientName,
  disabled = false,
  onConfirm,
  onManualItem,
}: CatalogPickerProps) {
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(
    new Map(),
  );

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

  function setQuantity(itemId: string, delta: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(itemId);
      if (!entry) return prev;
      const newQty = Math.max(1, entry.quantity + delta);
      next.set(itemId, { ...entry, quantity: newQty });
      return next;
    });
  }

  const selectedList = Array.from(selected.values());
  const subtotal = selectedList.reduce(
    (sum, s) => sum + s.item.price * s.quantity,
    0,
  );

  function handleConfirm() {
    const quotationItems: ChatSuggestedQuotationItem[] = selectedList.map(
      (s) => ({
        catalogItemId: s.item.id,
        name: s.item.name,
        description: s.item.description,
        quantity: s.quantity,
        unit: s.item.unit,
        unitPrice: s.item.price,
      }),
    );
    onConfirm(quotationItems);
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
            className="mt-3 flex items-center gap-2 rounded-lg bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#00E5A0]"
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
          const isSelected = !!entry;

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
                  {isSelected && (
                    <CheckCircle2 className="h-3 w-3 text-black" />
                  )}
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

              {isSelected && entry && (
                <div className="flex items-center justify-between border-t border-[#2A2D3E] px-3 py-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setQuantity(item.id, -1)}
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
                      onClick={() => setQuantity(item.id, 1)}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/chat/catalog-picker.tsx
git commit -m "feat(chat): add CatalogPicker component with quantity controls"
```

---

## Task 5 — CotizacionPreview component

**Files:**
- Create: `components/chat/cotizacion-preview.tsx`

- [ ] **Step 1: Create the component**

Create `components/chat/cotizacion-preview.tsx`:

```tsx
import { Loader2 } from "lucide-react";
import type { ChatSuggestedQuotationItem } from "@/types";
import { formatCurrencyAmount } from "@/lib/formatting";

type CotizacionPreviewProps = {
  clientName: string;
  items: ChatSuggestedQuotationItem[];
  isSaving?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
};

export function CotizacionPreview({
  clientName,
  items,
  isSaving = false,
  onConfirm,
  onEdit,
}: CotizacionPreviewProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#2A2D3E] bg-[#1A1D27] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#8B8FA8]">
            Cotización para
          </p>
          <p className="mt-0.5 text-base font-semibold text-white">
            {clientName}
          </p>
        </div>
        <span className="rounded-lg bg-[#0F1117] px-2.5 py-1 text-xs font-medium text-[#8B8FA8]">
          Borrador
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="flex items-center justify-between gap-2 rounded-lg bg-[#0F1117] px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {item.name}
              </p>
              <p className="text-xs text-[#8B8FA8]">
                {item.quantity} {item.unit} ×{" "}
                {formatCurrencyAmount(item.unitPrice, "ARS")}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-white">
              {formatCurrencyAmount(item.quantity * item.unitPrice, "ARS")}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[#2A2D3E] pt-3">
        <p className="text-sm font-medium text-[#8B8FA8]">Total estimado</p>
        <p className="text-xl font-bold text-[#00E5A0]">
          {formatCurrencyAmount(subtotal, "ARS")}
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={isSaving}
          onClick={onEdit}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[#2A2D3E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#222536] active:opacity-80 disabled:opacity-50"
        >
          Editar
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onConfirm}
          className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#00E5A0] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#00C984] active:opacity-80 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Confirmar y guardar"
          )}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/chat/cotizacion-preview.tsx
git commit -m "feat(chat): add CotizacionPreview component"
```

---

## Task 6 — CotizacionCreada component

**Files:**
- Create: `components/chat/cotizacion-creada.tsx`

- [ ] **Step 1: Create the component**

Create `components/chat/cotizacion-creada.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, Plus, Share2 } from "lucide-react";
import Link from "next/link";

type CotizacionCreadaProps = {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  total: number;
  currency?: string;
  onNewQuotation?: () => void;
};

export function CotizacionCreada({
  quotationId,
  quotationNumber,
  clientName,
  total,
  currency = "ARS",
  onNewQuotation,
}: CotizacionCreadaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(id);
  }, []);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const whatsappText = encodeURIComponent(
    `Hola, te comparto la cotización ${quotationNumber}: ${appUrl}/cotizaciones/${quotationId}`,
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;
  const formattedTotal = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(total);

  return (
    <div
      className={`mt-3 flex flex-col gap-4 rounded-xl border border-[#00E5A0]/30 bg-[#00E5A0]/5 p-4 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00E5A0]">
          <CheckCircle2 className="h-5 w-5 text-black" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">
            ¡Cotización guardada!
          </p>
          <p className="text-xs text-[#8B8FA8]">
            {quotationNumber} · {clientName}
          </p>
        </div>
        <p className="ml-auto text-base font-bold text-[#00E5A0]">
          {formattedTotal}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/cotizaciones/${quotationId}`}
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-[#1A1D27] px-2 py-2 text-center text-xs font-medium text-white transition hover:bg-[#222536] active:opacity-80"
        >
          <Eye className="h-4 w-4 text-[#8B8FA8]" />
          Ver
        </Link>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-[#1A1D27] px-2 py-2 text-center text-xs font-medium text-white transition hover:bg-[#222536] active:opacity-80"
        >
          <Share2 className="h-4 w-4 text-[#8B8FA8]" />
          Compartir
        </a>

        {onNewQuotation && (
          <button
            type="button"
            onClick={onNewQuotation}
            className="flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl bg-[#1A1D27] px-2 py-2 text-xs font-medium text-white transition hover:bg-[#222536] active:opacity-80"
          >
            <Plus className="h-4 w-4 text-[#8B8FA8]" />
            Nueva
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/chat/cotizacion-creada.tsx
git commit -m "feat(chat): add CotizacionCreada success component"
```

---

## Task 7 — SuggestionChips component

**Files:**
- Create: `components/chat/suggestion-chips.tsx`

- [ ] **Step 1: Create the component**

Create `components/chat/suggestion-chips.tsx`:

```tsx
type SuggestionChipsProps = {
  phase: "idle" | "with_client" | "with_items" | "post_saved";
  disabled?: boolean;
  onChipClick: (prompt: string) => void;
};

const CHIPS: Record<SuggestionChipsProps["phase"], Array<{ label: string; prompt: string }>> = {
  idle: [
    { label: "📝 Nueva cotización", prompt: "Crear una cotización" },
    { label: "💰 ¿Cuánto gané?", prompt: "¿Cuánto gané este mes?" },
    { label: "📋 Ver cotizaciones", prompt: "¿Cuántas cotizaciones tengo este mes?" },
    { label: "📦 Registrar gasto", prompt: "Registrar un gasto" },
  ],
  with_client: [
    { label: "✏️ Ítem manual", prompt: "Agregar ítem manual a la cotización" },
    { label: "➕ Más ítems", prompt: "Quiero agregar más ítems" },
    { label: "📋 Ver resumen", prompt: "Mostrame el resumen de la cotización" },
  ],
  with_items: [
    { label: "➕ Agregar más", prompt: "Quiero agregar más ítems" },
    { label: "👁️ Ver resumen", prompt: "Mostrame el resumen antes de confirmar" },
    { label: "🗒️ Agregar nota", prompt: "Quiero agregar una nota a la cotización" },
  ],
  post_saved: [
    { label: "📝 Crear otra", prompt: "Crear una nueva cotización" },
    { label: "💰 ¿Cuánto gané?", prompt: "¿Cuánto gané este mes?" },
    { label: "📋 Ver todo", prompt: "¿Cuántas cotizaciones tengo?" },
  ],
};

export function SuggestionChips({
  phase,
  disabled = false,
  onChipClick,
}: SuggestionChipsProps) {
  const chips = CHIPS[phase];

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          disabled={disabled}
          onClick={() => onChipClick(chip.prompt)}
          className="rounded-full border border-[#2A2D3E] bg-[#1A1D27] px-3 py-1.5 text-xs text-white transition hover:border-[#00E5A0]/50 hover:bg-[#222536] active:opacity-80 disabled:opacity-50"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/chat/suggestion-chips.tsx
git commit -m "feat(chat): add SuggestionChips contextual prompt buttons"
```

---

## Task 8 — Update ChatMessageList to render new components

**Files:**
- Modify: `components/chat/chat-message-list.tsx`

The `ChatUiHint` type is now a discriminated union. Update the message list to render `CatalogPicker` for `catalog_picker` hints.

- [ ] **Step 1: Read the current file first**

Read `components/chat/chat-message-list.tsx` — it's 133 lines, you should have it in context already.

- [ ] **Step 2: Rewrite the file**

Replace the entire content of `components/chat/chat-message-list.tsx` with:

```tsx
"use client";

import { Bot } from "lucide-react";

import { CatalogPicker } from "@/components/chat/catalog-picker";
import { ClientSelectorMessage } from "@/components/chat/client-selector-message";
import { CotizacionCreada } from "@/components/chat/cotizacion-creada";
import { CotizacionPreview } from "@/components/chat/cotizacion-preview";
import type {
  CatalogPickerItem,
  ChatClientListItem,
  ChatRole,
  ChatSuggestedQuotationItem,
  ChatUiHint,
} from "@/types";

type SavedQuotationInfo = {
  quotationId: string;
  quotationNumber: string;
  clientName: string;
  total: number;
};

type PendingPreviewInfo = {
  clientName: string;
  items: ChatSuggestedQuotationItem[];
};

export type ChatUiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  uiHint?: ChatUiHint | null;
  savedQuotation?: SavedQuotationInfo | null;
  pendingPreview?: PendingPreviewInfo | null;
};

type ChatMessageListProps = {
  messages: ChatUiMessage[];
  isSubmitting?: boolean;
  onQuickPrompt: (prompt: string) => void;
  onClientSelect: (client: ChatClientListItem) => void;
  onCatalogConfirm: (
    clientId: string,
    clientName: string,
    items: ChatSuggestedQuotationItem[],
  ) => void;
  onPreviewConfirm: (clientName: string, items: ChatSuggestedQuotationItem[]) => void;
  onPreviewEdit: () => void;
  onNewQuotation: () => void;
};

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatMessageList({
  messages,
  isSubmitting = false,
  onQuickPrompt,
  onClientSelect,
  onCatalogConfirm,
  onPreviewConfirm,
  onPreviewEdit,
  onNewQuotation,
}: ChatMessageListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto bg-[#0F1117] px-4 py-4 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#00E5A0] text-black">
              <Bot className="h-10 w-10" />
            </div>
            <p className="text-lg font-semibold text-white">Hola! Soy tu asistente.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Puedo crear cotizaciones, registrar gastos y responder preguntas.
            </p>
            <div className="grid w-full max-w-md grid-cols-2 gap-2">
              {[
                "Crear una cotización",
                "Registrar un gasto",
                "¿Cómo voy este mes?",
                "¿Qué puedo hacer?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onQuickPrompt(prompt)}
                  className="rounded-full border border-token bg-[#1A1D27] px-3 py-2 text-xs text-white transition hover:border-[#00E5A0]/50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";
              const timestamp = formatTimestamp(message.createdAt);

              if (message.savedQuotation) {
                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="flex max-w-[90%] items-end gap-2">
                      <div className="mb-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00E5A0] text-black">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="w-full">
                        <CotizacionCreada
                          quotationId={message.savedQuotation.quotationId}
                          quotationNumber={message.savedQuotation.quotationNumber}
                          clientName={message.savedQuotation.clientName}
                          total={message.savedQuotation.total}
                          onNewQuotation={onNewQuotation}
                        />
                        {timestamp ? (
                          <p className="mt-1 px-1 text-left text-[11px] text-muted-foreground">
                            {timestamp}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              }

              if (message.pendingPreview) {
                return (
                  <div key={message.id} className="flex justify-start">
                    <div className="flex max-w-[90%] items-end gap-2">
                      <div className="mb-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00E5A0] text-black">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="w-full">
                        <CotizacionPreview
                          clientName={message.pendingPreview.clientName}
                          items={message.pendingPreview.items}
                          isSaving={isSubmitting}
                          onConfirm={() =>
                            onPreviewConfirm(
                              message.pendingPreview!.clientName,
                              message.pendingPreview!.items,
                            )
                          }
                          onEdit={onPreviewEdit}
                        />
                        {timestamp ? (
                          <p className="mt-1 px-1 text-left text-[11px] text-muted-foreground">
                            {timestamp}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              }

              const clientSelectorHint =
                isAssistant && message.uiHint?.type === "client_selector"
                  ? message.uiHint
                  : null;

              const catalogPickerHint =
                isAssistant && message.uiHint?.type === "catalog_picker"
                  ? message.uiHint
                  : null;

              return (
                <div
                  key={message.id}
                  className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`flex max-w-[90%] items-end gap-2 ${
                      isAssistant ? "" : "flex-row-reverse"
                    }`}
                  >
                    {isAssistant ? (
                      <div className="mb-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00E5A0] text-black">
                        <Bot className="h-4 w-4" />
                      </div>
                    ) : null}
                    <div>
                      {message.content && (
                        <div
                          className={`px-4 py-3 text-sm leading-6 shadow-sm ${
                            isAssistant
                              ? "rounded-[18px_18px_18px_4px] bg-[#1A1D27] text-white"
                              : "rounded-[18px_18px_4px_18px] bg-[#00E5A0] text-black"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {clientSelectorHint ? (
                            <ClientSelectorMessage
                              clients={clientSelectorHint.clients}
                              disabled={isSubmitting}
                              onSelect={onClientSelect}
                            />
                          ) : null}
                          {catalogPickerHint ? (
                            <CatalogPicker
                              items={catalogPickerHint.items as CatalogPickerItem[]}
                              clientName={catalogPickerHint.clientName}
                              disabled={isSubmitting}
                              onConfirm={(selectedItems) =>
                                onCatalogConfirm(
                                  catalogPickerHint.clientId,
                                  catalogPickerHint.clientName,
                                  selectedItems,
                                )
                              }
                            />
                          ) : null}
                        </div>
                      )}
                      {timestamp ? (
                        <p
                          className={`mt-1 px-1 text-[11px] text-muted-foreground ${
                            isAssistant ? "text-left" : "text-right"
                          }`}
                        >
                          {timestamp}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output. (Note: `chat-shell.tsx` will have errors until Task 9 is complete — that's expected since we changed the `ChatUiMessage` type and `ChatMessageListProps`.)

- [ ] **Step 4: Commit**

```bash
git add components/chat/chat-message-list.tsx
git commit -m "feat(chat): update ChatMessageList to render CatalogPicker, CotizacionPreview, CotizacionCreada"
```

---

## Task 9 — Integrate all components in ChatShell

**Files:**
- Modify: `components/chat/chat-shell.tsx`

This is the most complex change. We need to:
1. Import `getCatalogItemsAction`
2. Add quotation flow phase state: `quotationPhase`
3. After `handleClientSelect` response, fetch catalog items and inject a `catalog_picker` message
4. Handle `onCatalogConfirm` → show `CotizacionPreview` via `pendingPreview` message
5. Handle `onPreviewConfirm` → call `confirmDraftQuotationSuggestionAction` → show `CotizacionCreada` via `savedQuotation` message
6. Wire `SuggestionChips`
7. Export `ChatUiMessage` from `chat-message-list` and use it in `chat-shell`

- [ ] **Step 1: Read the current chat-shell.tsx (already done — it's 269 lines)**

- [ ] **Step 2: Rewrite chat-shell.tsx**

Replace the entire content of `components/chat/chat-shell.tsx` with:

```tsx
"use client";

import { useRef, useState } from "react";
import { Bot, Circle } from "lucide-react";

import {
  confirmDraftQuotationSuggestionAction,
  confirmExpenseCreateSuggestionAction,
  getCatalogItemsAction,
} from "@/app/actions/ai";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import type { ChatUiMessage } from "@/components/chat/chat-message-list";
import { SuggestionChips } from "@/components/chat/suggestion-chips";
import { formatCurrencyAmount } from "@/lib/formatting";
import { getNextPendingSuggestion } from "@/lib/chat/pending-suggestion";
import type {
  ChatClientListItem,
  ChatReplyPayload,
  ChatRole,
  ChatSuggestedAction,
  ChatSuggestedQuotationItem,
  ChatUiHint,
} from "@/types";

type ChatResponse = ChatReplyPayload & {
  error?: string;
};

type QuotationPhase = "idle" | "with_client" | "with_items" | "post_saved";

async function getJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

const CONFIRM_REGEX = /^(si|sí|dale|confirma|confirmá|ok|de una|mandale)\b/i;
const CANCEL_REGEX = /^(no|cancel(a|á)|descarta|dejalo)\b/i;

function buildSuggestionPreview(suggestion: ChatSuggestedAction) {
  if (suggestion.type === "draft_quotation_create") {
    const lines = suggestion.items
      .slice(0, 4)
      .map(
        (item) =>
          `- ${item.name}: ${item.quantity} ${item.unit} x ${formatCurrencyAmount(item.unitPrice, "ARS")}`,
      );

    return [
      "Preview de cotización (todavía NO guardada):",
      `Cliente: ${suggestion.clientName ?? "Sin cliente"}`,
      ...lines,
      "Respondé «sí» para guardarla en tu cuenta.",
    ].join("\n");
  }

  if (suggestion.type === "expense_create") {
    return [
      "Preview de gasto:",
      `Gasto: ${suggestion.category} — ${formatCurrencyAmount(suggestion.amount, suggestion.currency)} — ${suggestion.date}`,
      `Descripción: ${suggestion.description}`,
      "¿Confirmo y lo guardo?",
    ].join("\n");
  }

  return "Tengo una acción sugerida lista para confirmar. ¿La ejecuto?";
}

export function ChatShell() {
  const nextMessageIdRef = useRef(1);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingSuggestion, setPendingSuggestion] = useState<ChatSuggestedAction | null>(null);
  const [selectedClient, setSelectedClient] = useState<ChatClientListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quotationPhase, setQuotationPhase] = useState<QuotationPhase>("idle");
  const pendingPreviewRef = useRef<{
    clientId: string;
    clientName: string;
    items: ChatSuggestedQuotationItem[];
  } | null>(null);

  function createMessage(
    role: ChatRole,
    content: string,
    extra?: Partial<Omit<ChatUiMessage, "id" | "role" | "content" | "createdAt">>,
  ): ChatUiMessage {
    const id = `message-${nextMessageIdRef.current}`;
    nextMessageIdRef.current += 1;

    return {
      id,
      role,
      content,
      createdAt: new Date().toISOString(),
      ...extra,
    };
  }

  async function sendUserMessage(
    content: string,
    options?: {
      selectedClient?: ChatClientListItem | null;
    },
  ) {
    const trimmedContent = content.trim();

    if (!trimmedContent || isSubmitting) {
      return;
    }

    const activeSelectedClient = options?.selectedClient ?? selectedClient;

    const userMessage = createMessage("user", trimmedContent);

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInputValue("");

    if (pendingSuggestion && CONFIRM_REGEX.test(trimmedContent)) {
      setIsSubmitting(true);
      try {
        if (pendingSuggestion.type === "draft_quotation_create") {
          const result = await confirmDraftQuotationSuggestionAction(pendingSuggestion);
          const total = pendingSuggestion.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0,
          );
          setMessages((currentMessages) => [
            ...currentMessages,
            createMessage("assistant", "", {
              savedQuotation: {
                quotationId: result.quotationId,
                quotationNumber: result.number,
                clientName: pendingSuggestion.clientName ?? "Cliente",
                total,
              },
            }),
          ]);
          setPendingSuggestion(null);
          setSelectedClient(null);
          setQuotationPhase("post_saved");
        } else if (pendingSuggestion.type === "expense_create") {
          const result = await confirmExpenseCreateSuggestionAction(pendingSuggestion);
          setMessages((currentMessages) => [
            ...currentMessages,
            createMessage(
              "assistant",
              `Listo. Registré el gasto "${result.description}" por ${formatCurrencyAmount(result.amount, result.currency)} en ${result.category}.`,
            ),
          ]);
          setPendingSuggestion(null);
          setSelectedClient(null);
          setQuotationPhase("idle");
        }
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "No se pudo confirmar la acción.";
        setMessages((currentMessages) => [
          ...currentMessages,
          createMessage("assistant", `No pude confirmarlo: ${message}`),
        ]);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (pendingSuggestion && CANCEL_REGEX.test(trimmedContent)) {
      setPendingSuggestion(null);
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", "Perfecto, descarté esa acción."),
      ]);
      setQuotationPhase("idle");
      return;
    }

    const requestMessages = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setPendingSuggestion(getNextPendingSuggestion({ type: "submit" }));
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: requestMessages,
          selectedClientId: activeSelectedClient?.id ?? null,
        }),
      });
      const payload = await getJsonResponse<ChatResponse>(response);

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "No se pudo obtener una respuesta del chat.");
      }

      const uiHint = payload.uiHint ?? null;

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", payload.reply, { uiHint }),
      ]);
      const nextSuggestion = getNextPendingSuggestion({
        type: "response",
        suggestedAction: payload.suggestedAction,
      });
      setPendingSuggestion(nextSuggestion);
      if (nextSuggestion) {
        setMessages((currentMessages) => [
          ...currentMessages,
          createMessage("assistant", buildSuggestionPreview(nextSuggestion)),
        ]);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "No se pudo obtener una respuesta del chat.";

      setPendingSuggestion(getNextPendingSuggestion({ type: "error" }));
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", `No se pudo responder: ${message}`),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    await sendUserMessage(inputValue);
  }

  async function handleClientSelect(client: ChatClientListItem) {
    setSelectedClient(client);
    setQuotationPhase("with_client");
    setIsSubmitting(true);

    try {
      const catalogItems = await getCatalogItemsAction();
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("user", `Cliente seleccionado: ${client.nombre}`),
        createMessage("assistant", "¿Qué ítems incluís en la cotización?", {
          uiHint: {
            type: "catalog_picker",
            items: catalogItems,
            clientId: client.id,
            clientName: client.nombre,
          },
        }),
      ]);
    } catch {
      void sendUserMessage(`Cliente seleccionado: ${client.nombre}`, {
        selectedClient: client,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCatalogConfirm(
    clientId: string,
    clientName: string,
    items: ChatSuggestedQuotationItem[],
  ) {
    pendingPreviewRef.current = { clientId, clientName, items };
    setQuotationPhase("with_items");
    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage("assistant", "", {
        pendingPreview: { clientName, items },
      }),
    ]);
  }

  async function handlePreviewConfirm(
    clientName: string,
    items: ChatSuggestedQuotationItem[],
  ) {
    if (!pendingPreviewRef.current) return;
    const { clientId } = pendingPreviewRef.current;

    setIsSubmitting(true);
    try {
      const suggestion = {
        type: "draft_quotation_create" as const,
        clientId,
        clientName,
        clientSource: "existing" as const,
        notes: null,
        items,
      };
      const result = await confirmDraftQuotationSuggestionAction(suggestion);
      const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", "", {
          savedQuotation: {
            quotationId: result.quotationId,
            quotationNumber: result.number,
            clientName,
            total,
          },
        }),
      ]);
      setSelectedClient(null);
      pendingPreviewRef.current = null;
      setQuotationPhase("post_saved");
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "No se pudo guardar la cotización.";
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", `No se pudo guardar: ${message}`),
      ]);
      setQuotationPhase("with_items");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePreviewEdit() {
    pendingPreviewRef.current = null;
    setQuotationPhase("with_client");
    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage(
        "assistant",
        "Ok, descartamos esa selección. Decime qué querés agregar o cambiar.",
      ),
    ]);
  }

  function handleNewQuotation() {
    setQuotationPhase("idle");
    setSelectedClient(null);
    setPendingSuggestion(null);
    pendingPreviewRef.current = null;
    void sendUserMessage("Crear una nueva cotización");
  }

  function handleQuickPrompt(prompt: string) {
    setInputValue(prompt);
  }

  function handleChipClick(prompt: string) {
    void sendUserMessage(prompt);
  }

  return (
    <div className="flex h-full min-h-[75vh] flex-col overflow-hidden rounded-[1.75rem] border border-token bg-[#0F1117]">
      <header className="sticky top-0 z-20 flex items-center border-b border-token bg-[#0F1117] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00E5A0] text-black">
            <Bot className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">Asistente automático</p>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Circle className="h-2.5 w-2.5 fill-[#00E5A0] text-[#00E5A0]" />
              Listo para ayudarte
            </p>
          </div>
        </div>
      </header>

      <ChatMessageList
        messages={messages}
        isSubmitting={isSubmitting}
        onQuickPrompt={handleQuickPrompt}
        onClientSelect={handleClientSelect}
        onCatalogConfirm={handleCatalogConfirm}
        onPreviewConfirm={handlePreviewConfirm}
        onPreviewEdit={handlePreviewEdit}
        onNewQuotation={handleNewQuotation}
      />

      <SuggestionChips
        phase={quotationPhase}
        disabled={isSubmitting}
        onChipClick={handleChipClick}
      />

      <ChatInput
        value={inputValue}
        isLoading={isSubmitting}
        onChange={setInputValue}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/chat/chat-shell.tsx
git commit -m "feat(chat): integrate CatalogPicker, CotizacionPreview, CotizacionCreada, SuggestionChips into ChatShell"
```

---

## Task 10 — Final Build Verification

**Files:** None

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: build completes successfully with no errors.

- [ ] **Step 2: Check for regressions**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: auditoría y mejora total del chat IA y bugs críticos"
```

---

## Spec Coverage Self-Review

| Spec Item | Task | Status |
|-----------|------|--------|
| BUG 1 — chat no guarda | N/A — **chat ya funciona correctamente** (JSON mode + confirm flow) | ✓ VERIFIED |
| BUG 2 — ClientPicker roto | Task 3 | ✓ COVERED |
| BUG 3 — CatalogPicker no existe | Tasks 4 + 9 | ✓ COVERED |
| BUG 4 — PDF en producción | N/A — **ya tiene `runtime = 'nodejs'` y headers correctos** | ✓ VERIFIED |
| BUG 5 — Logo upload Clerk vs UUID | N/A — **resolución Clerk→UUID centralizada en `requireUser()`; upload usa el UUID correcto** | ✓ VERIFIED |
| BUG 6 — Tax button | No evidencia de bug en el código; investigar en cotizaciones/nueva si hace falta | ⚠️ OUT OF SCOPE |
| PERF 1 — Promise.all | N/A — **ya usa Promise.all en route handler y pages** | ✓ VERIFIED |
| PERF 2 — use client | No `use client` innecesarios detectados | ✓ VERIFIED |
| PERF 3 — loading.tsx | 7 archivos loading.tsx ya existen | ✓ VERIFIED |
| CHAT 1 — SuggestionChips | Task 7 | ✓ COVERED |
| CHAT 2 — CotizacionPreview | Task 5 | ✓ COVERED |
| CHAT 3 — CotizacionCreada | Task 6 | ✓ COVERED |
| CHAT 4 — Imágenes facturas | No scope — requiere diseño separado | ⚠️ OUT OF SCOPE |
| SEC 1 — Rate limiting | N/A — **ya implementado en `lib/ai/rate-limit.ts`** | ✓ VERIFIED |
| SEC 2 — Validación inputs | Server actions ya validan con checks manuales robustos | ✓ VERIFIED |
| SEC 3 — RLS Supabase | Reportar SQL si hay problemas (manual review needed) | ⚠️ OUT OF SCOPE |
| CLEAN 1 — console.log | N/A — **cero console.log encontrados** | ✓ VERIFIED |
| CLEAN 2 — TypeScript any | N/A — **cero any encontrados, zero TS errors** | ✓ VERIFIED |
| BUILD — npm run build | Task 10 | ✓ COVERED |

---

## SQL para revisar en Supabase (no ejecutar automáticamente)

Correr en el Dashboard de Supabase → SQL Editor para auditar políticas RLS:

```sql
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

Verificar que TODAS las políticas usen `public.current_profile_id()` (o `clerk_id = public.clerk_user_id()` en `profiles`) y **ninguna** use `auth.uid()` — bajo Clerk, `auth.uid()` devuelve NULL y la política bloquea todo. Las migraciones `20260602_clerk_auth_rls.sql`, `20260603_repair_profiles_rls_clerk.sql` y `20260605_fix_clerk_rls_remaining_policies.sql` hacen esta conversión; confirmar que la última esté aplicada en el Dashboard (está sin trackear en git).
