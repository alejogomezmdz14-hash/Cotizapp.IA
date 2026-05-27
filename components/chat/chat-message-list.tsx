"use client";

import Link from "next/link";
import { BadgeDollarSign, Bot, CheckCircle2, FileText, Loader2, User2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatRole, ChatSuggestedAction } from "@/types";

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

type ChatMessageListProps = {
  messages: ChatUiMessage[];
  pendingSuggestion: ChatSuggestedAction | null;
  isConfirming: boolean;
  feedback: ChatFeedback | null;
  onConfirmSuggestion: () => void;
  onDismissSuggestion: () => void;
};

function formatMoney(value: number) {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ChatMessageList({
  messages,
  pendingSuggestion,
  isConfirming,
  feedback,
  onConfirmSuggestion,
  onDismissSuggestion,
}: ChatMessageListProps) {
  return (
    <Card className="shell-panel overflow-hidden shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Conversación</CardTitle>
            <CardDescription className="leading-6">
              El asistente puede consultar contexto de clientes, catálogo y
              cotizaciones. Si propone escribir algo, siempre te pedirá
              confirmación explícita.
            </CardDescription>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Mensajes
            </p>
            <p className="mt-2 font-semibold text-foreground">{messages.length}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-[1.75rem] border border-token/80 bg-background/55 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Historial activo
            </div>
            {pendingSuggestion ? (
              <span className="rounded-full border border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.12)] px-3 py-1 text-xs font-medium text-foreground">
                Confirmación pendiente
              </span>
            ) : null}
          </div>

          <div className="space-y-4">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  {isAssistant ? (
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-token/80 bg-background text-accent-token">
                      <Bot className="h-4 w-4" />
                    </div>
                  ) : null}

                  <div
                    className={`max-w-[88%] rounded-[1.5rem] border px-4 py-3 text-sm leading-6 shadow-sm ${
                      isAssistant
                        ? "border-token/80 bg-background/80 text-foreground"
                        : "border-accent-token/40 bg-accent-token text-black"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em]">
                      {isAssistant ? (
                        <>
                          <Bot className="h-3.5 w-3.5" />
                          Asistente
                        </>
                      ) : (
                        <>
                          <User2 className="h-3.5 w-3.5" />
                          Vos
                        </>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {!isAssistant ? (
                    <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-accent-token/40 bg-accent-token text-black">
                      <User2 className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {pendingSuggestion ? (
          <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-token/80 bg-surface text-accent-token">
                {pendingSuggestion.type === "draft_quotation_create" ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <BadgeDollarSign className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {pendingSuggestion.type === "draft_quotation_create"
                    ? "Confirmar borrador sugerido"
                    : "Confirmar actualizacion de precio"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Nada se ejecuta hasta que lo confirmes desde este bloque.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {pendingSuggestion.type === "draft_quotation_create" ? (
                <div className="space-y-3 text-sm">
                  <p>
                    {pendingSuggestion.clientSource === "existing"
                      ? "Cliente existente: "
                      : "Cliente nuevo a crear: "}
                    <span className="font-medium text-foreground">
                      {pendingSuggestion.clientName ?? "Cliente sugerido"}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {pendingSuggestion.clientSource === "existing"
                      ? "El borrador usara el cliente guardado que coincide con ese registro."
                      : "Al confirmar tambien se creara un cliente nuevo con ese nombre antes del borrador."}
                  </p>
                  {pendingSuggestion.notes ? (
                    <p className="text-muted-foreground">{pendingSuggestion.notes}</p>
                  ) : null}
                  <div className="space-y-2">
                    {pendingSuggestion.items.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="rounded-[1.25rem] border border-token/70 bg-surface px-3 py-3"
                      >
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-muted-foreground">
                          {item.quantity} x {item.unit} a ${formatMoney(item.unitPrice)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <p>
                    Item:{" "}
                    <span className="font-medium text-foreground">
                      {pendingSuggestion.itemName}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Precio actual: ${formatMoney(pendingSuggestion.currentPrice)}
                  </p>
                  <p className="text-muted-foreground">
                    Precio sugerido: ${formatMoney(pendingSuggestion.suggestedPrice)}
                  </p>
                  {pendingSuggestion.reason ? (
                    <p className="text-muted-foreground">{pendingSuggestion.reason}</p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  onClick={onConfirmSuggestion}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirmando...
                    </>
                  ) : pendingSuggestion.type === "draft_quotation_create" ? (
                    "Crear borrador"
                  ) : (
                    "Actualizar precio"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDismissSuggestion}
                  disabled={isConfirming}
                  className="bg-background/75"
                >
                  Descartar sugerencia
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {feedback ? (
          <div
            className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            <div className="flex items-start gap-2">
              {feedback.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="space-y-1">
                <p className="font-medium">{feedback.title}</p>
                <p>{feedback.description}</p>
                {feedback.href && feedback.hrefLabel ? (
                  <Link
                    href={feedback.href}
                    className="inline-flex font-medium underline underline-offset-4"
                  >
                    {feedback.hrefLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
