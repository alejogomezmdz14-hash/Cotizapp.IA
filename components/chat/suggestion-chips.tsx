type ChatPhase = "idle" | "with_client" | "with_items" | "post_saved";

export type SuggestionChipAction = "add_items";

type SuggestionChip = {
  label: string;
  prompt?: string;
  action?: SuggestionChipAction;
};

type SuggestionChipsProps = {
  phase: ChatPhase;
  disabled?: boolean;
  onChipClick: (prompt: string) => void;
  onAction?: (action: SuggestionChipAction) => void;
};

const CHIPS: Record<ChatPhase, SuggestionChip[]> = {
  idle: [
    { label: "📝 Nueva cotización", prompt: "Crear una cotización" },
    { label: "💰 ¿Cuánto gané?", prompt: "¿Cuánto gané este mes?" },
    {
      label: "📋 Ver cotizaciones",
      prompt: "¿Cuántas cotizaciones tengo este mes?",
    },
    { label: "📦 Registrar gasto", prompt: "Registrar un gasto" },
  ],
  with_client: [
    { label: "✏️ Ítem manual", prompt: "Agregar ítem manual a la cotización" },
  ],
  with_items: [
    { label: "➕ Agregar más ítems", action: "add_items" },
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
  onAction,
}: SuggestionChipsProps) {
  const chips = CHIPS[phase];

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (chip.action) {
              onAction?.(chip.action);
            } else if (chip.prompt) {
              onChipClick(chip.prompt);
            }
          }}
          className="rounded-full border border-[#2A2D3E] bg-[#1A1D27] px-3 py-1.5 text-xs text-white transition hover:border-[#00E5A0]/50 hover:bg-[#222536] active:opacity-80 disabled:opacity-50"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
