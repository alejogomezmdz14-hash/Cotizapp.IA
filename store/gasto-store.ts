import { create } from "zustand";

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export type GastoDraft = {
  description: string;
  amount: string;
  currency: string;
  category: string;
  date: string;
  notes: string;
  receiptPath: string | null;
  hasUnsavedDraft: boolean;
};

const initialGastoDraft = (defaultCurrency: string): GastoDraft => ({
  description: "",
  amount: "",
  currency: defaultCurrency,
  category: "Materiales",
  date: todayDateInputValue(),
  notes: "",
  receiptPath: null,
  hasUnsavedDraft: false,
});

function gastoDraftHasContent(draft: GastoDraft) {
  return Boolean(
    draft.description.trim() ||
      draft.amount.trim() ||
      draft.notes.trim() ||
      draft.receiptPath,
  );
}

type GastoStore = {
  draft: GastoDraft;
  initCurrency: (currency: string) => void;
  patchDraft: (updates: Partial<GastoDraft>) => void;
  resetDraft: (defaultCurrency: string) => void;
  markDirty: () => void;
  hasDraftContent: () => boolean;
};

export const useGastoStore = create<GastoStore>((set, get) => ({
  draft: initialGastoDraft("ARS"),

  initCurrency: (currency) =>
    set((state) => {
      if (state.draft.currency === currency) {
        return state;
      }
      return {
        draft: { ...state.draft, currency },
      };
    }),

  patchDraft: (updates) =>
    set((state) => ({
      draft: {
        ...state.draft,
        ...updates,
        hasUnsavedDraft: true,
      },
    })),

  resetDraft: (defaultCurrency) =>
    set({ draft: initialGastoDraft(defaultCurrency) }),

  markDirty: () =>
    set((state) => ({
      draft: { ...state.draft, hasUnsavedDraft: true },
    })),

  hasDraftContent: () => gastoDraftHasContent(get().draft),
}));
