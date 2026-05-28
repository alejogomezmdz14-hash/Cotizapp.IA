"use client";

import { Bot } from "lucide-react";

import type { ChatRole } from "@/types";

type ChatUiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ChatMessageListProps = {
  messages: ChatUiMessage[];
  onQuickPrompt: (prompt: string) => void;
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
  onQuickPrompt,
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
                      <div
                        className={`px-4 py-3 text-sm leading-6 shadow-sm ${
                          isAssistant
                            ? "rounded-[18px_18px_18px_4px] bg-[#1A1D27] text-white"
                            : "rounded-[18px_18px_4px_18px] bg-[#00E5A0] text-black"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
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
