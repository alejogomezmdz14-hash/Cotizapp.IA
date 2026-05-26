"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";

import {
  confirmCatalogPriceUpdateAction,
  confirmDraftQuotationSuggestionAction,
} from "@/app/actions/ai";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNextPendingSuggestion } from "@/lib/chat/pending-suggestion";
import type { ChatReplyPayload, ChatRole, ChatSuggestedAction } from "@/types";

type ChatUiMessage = {
  id: string;
  role: ChatRole;
  content: string;
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
  const [messages, setMessages] = useState<ChatUiMessage[]>([
    {
      id: "message-0",
      role: "assistant",
      content:
        "Hola. Puedo ayudarte a revisar clientes, catalogo y cotizaciones, y tambien proponer borradores o cambios de precio. Cualquier escritura queda siempre pendiente de tu confirmacion.",
    },
  ]);
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
              ? `Se creo un cliente nuevo y el borrador ${result.number}. Ya puedes revisarlo fuera del chat.`
              : `Se creo el borrador ${result.number} y ya puedes revisarlo fuera del chat.`,
          href: `/cotizaciones/nueva?quotationId=${result.quotationId}`,
          hrefLabel: "Abrir borrador",
        });
      } else {
        const result = await confirmCatalogPriceUpdateAction(pendingSuggestion);

        setFeedback({
          tone: "success",
          title: "Precio actualizado",
          description: `${result.itemName} paso de $${result.previousPrice.toLocaleString(
            "es-AR",
          )} a $${result.updatedPrice.toLocaleString("es-AR")}.`,
          href: "/catalogo",
          hrefLabel: "Ver catalogo",
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
      description: "No se persisitio ningun cambio desde el chat.",
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-accent-token">
              <MessageSquareText className="h-4 w-4" />
              Chat IA comercial
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-semibold tracking-tight">
                Consulta el negocio y prepara acciones para confirmar
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6">
                El asistente trabaja con contexto acotado de clientes, catalogo,
                cotizaciones y perfil. Puede proponerte borradores o cambios de
                precio, pero nunca los ejecuta solo.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-token bg-surface shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Guardrails del modulo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-token" />
              <p>Toda respuesta sale en espanol y toda escritura requiere confirmacion.</p>
            </div>
            <div className="flex gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-token" />
              <p>Puede sugerir borradores de cotizacion y ajustes puntuales de catalogo.</p>
            </div>
          </CardContent>
        </Card>
      </section>

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
