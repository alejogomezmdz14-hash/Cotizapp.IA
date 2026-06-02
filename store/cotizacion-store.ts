import { create } from "zustand";

import type { QuotationEditorItem } from "@/components/cotizacion/quotation-items-editor";
import { getDefaultQuotationValidityDate } from "@/lib/quotation-expiry";

export type InlineClientState = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type CotizacionDraft = {
  clientMode: "existing" | "inline";
  selectedClientId: string | null;
  inlineClient: InlineClientState;
  items: QuotationEditorItem[];
  taxRate: number;
  validUntil: string;
  notes: string;
  nextItemId: number;
  wizardStep: number;
  draftBannerVisible: boolean;
};

const emptyInlineClient = (): InlineClientState => ({
  name: "",
  email: "",
  phone: "",
  address: "",
});

export const initialCotizacionDraft = (): CotizacionDraft => ({
  clientMode: "existing",
  selectedClientId: null,
  inlineClient: emptyInlineClient(),
  items: [],
  taxRate: 0,
  validUntil: getDefaultQuotationValidityDate(),
  notes: "",
  nextItemId: 1,
  wizardStep: 1,
  draftBannerVisible: false,
});

function draftHasContent(draft: CotizacionDraft) {
  const hasClientData =
    draft.clientMode === "inline"
      ? Boolean(
          draft.inlineClient.name.trim() ||
            draft.inlineClient.email.trim() ||
            draft.inlineClient.phone.trim() ||
            draft.inlineClient.address.trim(),
        )
      : Boolean(draft.selectedClientId);

  return (
    hasClientData ||
    draft.items.length > 0 ||
    draft.taxRate > 0 ||
    Boolean(draft.notes.trim())
  );
}

type CotizacionStore = {
  draft: CotizacionDraft;
  setClientMode: (mode: "existing" | "inline") => void;
  setSelectedClientId: (id: string | null) => void;
  setInlineClient: (updates: Partial<InlineClientState>) => void;
  setItems: (items: QuotationEditorItem[]) => void;
  addItem: (item: QuotationEditorItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, data: Partial<QuotationEditorItem>) => void;
  setTaxRate: (taxRate: number) => void;
  setValidUntil: (fecha: string) => void;
  setNotes: (notas: string) => void;
  setWizardStep: (step: number) => void;
  allocNextItemId: () => number;
  dismissDraftBanner: () => void;
  showDraftBannerIfNeeded: () => void;
  resetDraft: (options?: { clientMode?: "existing" | "inline" }) => void;
  hydrateFromEditor: (payload: {
    clientId: string | null;
    clientName: string | null;
    items: QuotationEditorItem[];
    taxRate: number;
    validUntil: string;
    notes: string;
  }) => void;
  hasDraftContent: () => boolean;
};

export const useCotizacionStore = create<CotizacionStore>((set, get) => ({
  draft: initialCotizacionDraft(),

  setClientMode: (mode) =>
    set((state) => ({ draft: { ...state.draft, clientMode: mode } })),

  setSelectedClientId: (id) =>
    set((state) => ({ draft: { ...state.draft, selectedClientId: id } })),

  setInlineClient: (updates) =>
    set((state) => ({
      draft: {
        ...state.draft,
        inlineClient: { ...state.draft.inlineClient, ...updates },
      },
    })),

  setItems: (items) =>
    set((state) => ({ draft: { ...state.draft, items } })),

  addItem: (item) =>
    set((state) => ({
      draft: { ...state.draft, items: [...state.draft.items, item] },
    })),

  removeItem: (id) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: state.draft.items.filter((item) => item.id !== id),
      },
    })),

  updateItem: (id, data) =>
    set((state) => ({
      draft: {
        ...state.draft,
        items: state.draft.items.map((item) =>
          item.id === id ? { ...item, ...data } : item,
        ),
      },
    })),

  setTaxRate: (taxRate) =>
    set((state) => ({ draft: { ...state.draft, taxRate } })),

  setValidUntil: (fecha) =>
    set((state) => ({ draft: { ...state.draft, validUntil: fecha } })),

  setNotes: (notas) =>
    set((state) => ({ draft: { ...state.draft, notes: notas } })),

  setWizardStep: (step) =>
    set((state) => ({ draft: { ...state.draft, wizardStep: step } })),

  allocNextItemId: () => {
    const current = get().draft.nextItemId;
    set((state) => ({
      draft: { ...state.draft, nextItemId: state.draft.nextItemId + 1 },
    }));
    return current;
  },

  dismissDraftBanner: () =>
    set((state) => ({
      draft: { ...state.draft, draftBannerVisible: false },
    })),

  showDraftBannerIfNeeded: () => {
    const { draft } = get();
    if (draftHasContent(draft)) {
      set((state) => ({
        draft: { ...state.draft, draftBannerVisible: true },
      }));
    }
  },

  resetDraft: (options) =>
    set(() => {
      const next = initialCotizacionDraft();
      if (options?.clientMode) {
        next.clientMode = options.clientMode;
      }
      return { draft: next };
    }),

  hydrateFromEditor: (payload) =>
    set(() => ({
      draft: {
        ...initialCotizacionDraft(),
        clientMode: payload.clientId ? "existing" : "inline",
        selectedClientId: payload.clientId,
        inlineClient: {
          ...emptyInlineClient(),
          name: payload.clientName ?? "",
        },
        items: payload.items,
        taxRate: payload.taxRate,
        validUntil: payload.validUntil || getDefaultQuotationValidityDate(),
        notes: payload.notes,
        nextItemId: payload.items.length + 1,
        draftBannerVisible: false,
      },
    })),

  hasDraftContent: () => draftHasContent(get().draft),
}));
