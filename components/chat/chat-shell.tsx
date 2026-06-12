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
import type { CotizacionResumenValues } from "@/components/chat/cotizacion-resumen";
import { SuggestionChips } from "@/components/chat/suggestion-chips";
import type { SuggestionChipAction } from "@/components/chat/suggestion-chips";
import { formatCurrencyAmount } from "@/lib/formatting";
import { getNextPendingSuggestion } from "@/lib/chat/pending-suggestion";
import type {
  ChatClientListItem,
  ChatReplyPayload,
  ChatRole,
  ChatSuggestedAction,
  ChatSuggestedQuotationItem,
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
  const draftRef = useRef<{
    clientId: string;
    clientName: string;
    items: ChatSuggestedQuotationItem[];
    taxRate: number | null;
    validUntil: string | null;
    notes: string | null;
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

    // "Agregar más ítems" con un borrador activo: reabrir el selector de
    // catálogo en vez de mandarle el pedido a la IA (que pide texto libre).
    if (
      draftRef.current &&
      /\bagregar\s+(m[áa]s|otro)\b/i.test(trimmedContent) &&
      /[íi]tems?|productos?|materiales?|trabajos?|m[áa]s\b/i.test(trimmedContent)
    ) {
      void openCatalogPickerForDraft();
      return;
    }

    if (pendingSuggestion && CONFIRM_REGEX.test(trimmedContent)) {
      const suggestionToConfirm = pendingSuggestion;
      setIsSubmitting(true);
      try {
        if (suggestionToConfirm.type === "draft_quotation_create") {
          const result = await confirmDraftQuotationSuggestionAction(suggestionToConfirm);
          const total = suggestionToConfirm.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0,
          );
          setMessages((currentMessages) => [
            ...currentMessages,
            createMessage("assistant", "", {
              savedQuotation: {
                quotationId: result.quotationId,
                quotationNumber: result.number,
                clientName: suggestionToConfirm.clientName ?? "Cliente",
                total,
              },
            }),
          ]);
          setPendingSuggestion(null);
          setSelectedClient(null);
          setQuotationPhase("post_saved");
        } else if (suggestionToConfirm.type === "expense_create") {
          const result = await confirmExpenseCreateSuggestionAction(suggestionToConfirm);
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
      setQuotationPhase("idle");
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", "Perfecto, descarté esa acción."),
      ]);
      return;
    }

    const requestMessages = [...messages, userMessage]
      .filter((message) => message.content)
      .map((message) => ({
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

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", payload.reply, {
          uiHint: payload.uiHint ?? null,
        }),
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
    if (isSubmitting) {
      return;
    }

    setSelectedClient(client);
    setQuotationPhase("with_client");
    setIsSubmitting(true);
    draftRef.current = {
      clientId: client.id,
      clientName: client.nombre,
      items: [],
      taxRate: null,
      validUntil: null,
      notes: null,
    };

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
      setIsSubmitting(false);
    } catch {
      setIsSubmitting(false);
      void sendUserMessage(`Cliente seleccionado: ${client.nombre}`, {
        selectedClient: client,
      });
    }
  }

  /** Reabre el selector de catálogo con la selección actual del borrador. */
  async function openCatalogPickerForDraft() {
    const draft = draftRef.current;

    if (!draft || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const catalogItems = await getCatalogItemsAction();
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", "Dale, agregá o sacá ítems de la cotización:", {
          uiHint: {
            type: "catalog_picker",
            items: catalogItems,
            clientId: draft.clientId,
            clientName: draft.clientName,
            initialItems: draft.items,
          },
        }),
      ]);
    } catch {
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage(
          "assistant",
          "No pude cargar tu catálogo. Probá de nuevo en un momento.",
        ),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCatalogConfirm(
    clientId: string,
    clientName: string,
    items: ChatSuggestedQuotationItem[],
  ) {
    const previousDraft = draftRef.current;
    // La selección nueva reemplaza los ítems de catálogo; los ítems manuales
    // (sin catalogItemId) agregados antes se conservan.
    const manualItems =
      previousDraft && previousDraft.clientId === clientId
        ? previousDraft.items.filter((item) => !item.catalogItemId)
        : [];
    const mergedItems = [...items, ...manualItems];

    draftRef.current = {
      clientId,
      clientName,
      items: mergedItems,
      taxRate: previousDraft?.taxRate ?? null,
      validUntil: previousDraft?.validUntil ?? null,
      notes: previousDraft?.notes ?? null,
    };
    setQuotationPhase("with_items");
    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage("assistant", "", {
        pendingSummary: {
          items: mergedItems,
          initialTaxRate: previousDraft?.taxRate ?? null,
          initialValidUntil: previousDraft?.validUntil ?? null,
          initialNotes: previousDraft?.notes ?? null,
        },
      }),
    ]);
  }

  function handleSummaryConfirm(values: CotizacionResumenValues) {
    const draft = draftRef.current;

    if (!draft) {
      return;
    }

    draftRef.current = {
      ...draft,
      taxRate: values.taxRate > 0 ? values.taxRate : null,
      validUntil: values.validUntil || null,
      notes: values.notes,
    };
    setMessages((currentMessages) => [
      ...currentMessages,
      createMessage("assistant", "", {
        pendingPreview: {
          clientName: draft.clientName,
          items: draft.items,
          taxRate: values.taxRate > 0 ? values.taxRate : null,
          validUntil: values.validUntil || null,
          notes: values.notes,
        },
      }),
    ]);
  }

  async function handlePreviewConfirm(
    clientName: string,
    items: ChatSuggestedQuotationItem[],
  ) {
    const draft = draftRef.current;

    if (!draft || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmDraftQuotationSuggestionAction({
        type: "draft_quotation_create" as const,
        clientId: draft.clientId,
        clientName,
        clientSource: "existing" as const,
        notes: draft.notes,
        items,
        taxRate: draft.taxRate,
        validUntil: draft.validUntil,
      });
      const subtotal = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const total = draft.taxRate
        ? subtotal * (1 + draft.taxRate / 100)
        : subtotal;
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
      draftRef.current = null;
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
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePreviewEdit() {
    // Reabrir el selector de ítems con la selección actual, sin descartar nada.
    void openCatalogPickerForDraft();
  }

  function handleChipAction(action: SuggestionChipAction) {
    if (action === "add_items") {
      void openCatalogPickerForDraft();
    }
  }

  function handleNewQuotation() {
    setQuotationPhase("idle");
    setSelectedClient(null);
    setPendingSuggestion(null);
    draftRef.current = null;
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
        onSummaryConfirm={handleSummaryConfirm}
        onPreviewConfirm={handlePreviewConfirm}
        onPreviewEdit={handlePreviewEdit}
        onNewQuotation={handleNewQuotation}
      />

      <SuggestionChips
        phase={quotationPhase}
        disabled={isSubmitting}
        onChipClick={handleChipClick}
        onAction={handleChipAction}
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
