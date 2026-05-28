"use client";

import { useRef, useState } from "react";
import { Bot, Circle } from "lucide-react";

import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { getNextPendingSuggestion } from "@/lib/chat/pending-suggestion";
import type { ChatReplyPayload, ChatRole, ChatSuggestedAction } from "@/types";

type ChatUiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
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
  const nextMessageIdRef = useRef(1);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [, setPendingSuggestion] = useState<ChatSuggestedAction | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", `No se pudo responder: ${message}`),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleQuickPrompt(prompt: string) {
    setInputValue(prompt);
  }

  return (
    <div className="flex h-full min-h-[75vh] flex-col overflow-hidden rounded-[1.75rem] border border-token bg-[#0F1117]">
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
        onQuickPrompt={handleQuickPrompt}
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
