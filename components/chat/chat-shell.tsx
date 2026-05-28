"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Circle } from "lucide-react";

import {
  confirmCatalogPriceUpdateAction,
  confirmDraftQuotationSuggestionAction,
} from "@/app/actions/ai";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { formatCurrencyAmount } from "@/lib/formatting";
import { getNextPendingSuggestion } from "@/lib/chat/pending-suggestion";
import type { ChatReplyPayload, ChatRole, ChatSuggestedAction } from "@/types";

type ChatUiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ChatFeedback = {
  tone: "success" | "error";
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
};

type ChatResponse = ChatReplyPayload & {
  error?: string;
};

async function getJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export function ChatShell() {
  const router = useRouter();
  const nextMessageIdRef = useRef(1);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingSuggestion, setPendingSuggestion] = useState<ChatSuggestedAction | null>(
    null,
  );
  const [feedback, setFeedback] = useState<ChatFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  function createMessage(role: ChatRole, content: string): ChatUiMessage {
    const id = `message-${nextMessageIdRef.current}`;
    nextMessageIdRef.current += 1;

    return {
      id,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
  }

  async function handleSubmit() {
    const content = inputValue.trim();

    if (!content || isSubmitting) {
      return;
    }

    const userMessage = createMessage("user", content);
    const requestMessages = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInputValue("");
    setFeedback(null);
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
        }),
      });
      const payload = await getJsonResponse<ChatResponse>(response);

      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "No se pudo obtener una respuesta del chat.");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", payload.reply),
      ]);
      setPendingSuggestion(
        getNextPendingSuggestion({
          type: "response",
          suggestedAction: payload.suggestedAction,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "No se pudo obtener una respuesta del chat.";

      setPendingSuggestion(getNextPendingSuggestion({ type: "error" }));
      setFeedback({
        tone: "error",
        title: "No se pudo responder",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmSuggestion() {
    if (!pendingSuggestion || isConfirming) {
      return;
    }

    setIsConfirming(true);
    setFeedback(null);

    try {
      if (pendingSuggestion.type === "draft_quotation_create") {
        const result = await confirmDraftQuotationSuggestionAction(pendingSuggestion);

        setFeedback({
          tone: "success",
          title: "Borrador creado",
          description:
            pendingSuggestion.clientSource === "inline"
              ? `Se creó un cliente nuevo y el borrador ${result.number}. Ya puedes revisarlo fuera del chat.`
              : `Se creó el borrador ${result.number} y ya puedes revisarlo fuera del chat.`,
          href: `/cotizaciones/nueva?quotationId=${result.quotationId}`,
          hrefLabel: "Abrir borrador",
        });
      } else {
        const result = await confirmCatalogPriceUpdateAction(pendingSuggestion);

        setFeedback({
          tone: "success",
          title: "Precio actualizado",
          description: `${result.itemName} pasó de ${formatCurrencyAmount(
            result.previousPrice,
            "ARS",
          )} a ${formatCurrencyAmount(result.updatedPrice, "ARS")}.`,
          href: "/catalogo",
          hrefLabel: "Ver catálogo",
        });
      }

      setPendingSuggestion(null);
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo confirmar",
        description:
          error instanceof Error && error.message.trim()
            ? error.message
            : "No se pudo confirmar la sugerencia.",
      });
    } finally {
      setIsConfirming(false);
    }
  }

  function handleDismissSuggestion() {
    setPendingSuggestion(null);
    setFeedback({
      tone: "success",
      title: "Sugerencia descartada",
      description: "No se persistió ningún cambio desde el chat.",
    });
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-[1.75rem] border border-token bg-[#0F1117]">
      <header className="sticky top-0 z-20 flex items-center border-b border-token bg-[#0F1117] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00E5A0] text-black">
            <Bot className="h-5 w-5" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-white">Asistente Cotizapp</p>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Circle className="h-2.5 w-2.5 fill-[#00E5A0] text-[#00E5A0]" />
              En línea
            </p>
          </div>
        </div>
      </header>

      <ChatMessageList
        messages={messages}
        pendingSuggestion={pendingSuggestion}
        isConfirming={isConfirming}
        feedback={feedback}
        onConfirmSuggestion={handleConfirmSuggestion}
        onDismissSuggestion={handleDismissSuggestion}
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
