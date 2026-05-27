"use client";

import { type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ChatInputProps = {
  value: string;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

const textareaClassName =
  "flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function ChatInput({
  value,
  isLoading,
  onChange,
  onSubmit,
}: ChatInputProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    onSubmit();
  }

  return (
    <Card className="shell-panel overflow-hidden shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Escribí tu consulta</CardTitle>
            <CardDescription className="leading-6">
              Puedes pedir contexto del negocio, ayuda para armar una cotización o
              una propuesta de actualización de precios.
            </CardDescription>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Modo seguro
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej. Necesito un borrador para Cliente 2 con 20 bolsas de cemento y envío en 48 horas."
            disabled={isLoading}
            className={textareaClassName}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            "Consultar historial de cotizaciones",
            "Pedir un borrador sugerido",
            "Revisar precios del catálogo",
          ].map((hint) => (
            <span
              key={hint}
              className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground"
            >
              {hint}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Presiona Enter para enviar o Shift + Enter para un salto de línea.
          </p>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
          >
            <SendHorizontal className="mr-2 h-4 w-4" />
            {isLoading ? "Consultando..." : "Enviar mensaje"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
