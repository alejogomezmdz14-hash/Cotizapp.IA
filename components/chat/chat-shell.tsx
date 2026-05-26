"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  FileText,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

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
  const assistantMessageCount = messages.filter(
    (message) => message.role === "assistant",
  ).length;
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const pendingSuggestionLabel = pendingSuggestion
    ? pendingSuggestion.type === "draft_quotation_create"
      ? "Borrador pendiente de confirmacion"
      : "Cambio de precio pendiente"
    : "Sin sugerencias pendientes";

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
    <div className="space-y-5 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:items-end">
          <div className="space-y-5">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Chat IA comercial
              </span>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Un espacio conversacional con mejor jerarquia y confirmacion visible
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-7 sm:text-base">
                  Consulta el negocio, prepara borradores o revisa precios desde un
                  workspace mas claro, con el historial y la zona de acciones
                  separadas del contexto operativo.
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {["Clientes", "Catalogo", "Cotizaciones", "Confirmacion manual"].map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[1.75rem] border border-token bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Mensajes del asistente
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {assistantMessageCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Respuestas generadas dentro de esta conversacion.
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-token bg-background/60 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Estado actual
              </p>
              <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">
                {pendingSuggestionLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Cualquier cambio sugerido queda visible hasta que lo confirmes o lo
                descartes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="space-y-5">
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

        <div className="space-y-4 xl:sticky xl:top-6">
          <Card className="shell-panel overflow-hidden shadow-none">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Contexto del workspace</CardTitle>
              <CardDescription className="leading-6">
                El chat opera sobre datos reales, pero la escritura siempre se
                confirma aparte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-accent-token" />
                <p>{assistantMessageCount} mensajes del asistente y {userMessageCount} tuyos en la sesion actual.</p>
              </div>
              <div className="flex gap-2">
                <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-accent-token" />
                <p>{pendingSuggestionLabel}.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shell-panel overflow-hidden shadow-none">
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

          <Card className="shell-panel overflow-hidden shadow-none">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Siguiente accion</CardTitle>
              <CardDescription className="leading-6">
                Usa el chat para explorar y luego confirma el cambio desde el bloque
                correspondiente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                  <FileText className="h-4 w-4 text-accent-token" />
                  Recomendacion actual
                </div>
                <p>{pendingSuggestionLabel}.</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Confirma desde el hilo
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
