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
    <Card className="border-token bg-surface shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Escribi tu consulta</CardTitle>
        <CardDescription>
          Puedes pedir contexto del negocio, ayuda para armar una cotizacion o una
          propuesta de actualizacion de precios.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej. Necesito un borrador para Cliente 2 con 20 bolsas de cemento y envio en 48 horas."
          disabled={isLoading}
          className={textareaClassName}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Presiona Enter para enviar o Shift + Enter para un salto de linea.
          </p>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
            className="bg-accent-token text-black hover:bg-accent-hover"
          >
            <SendHorizontal className="mr-2 h-4 w-4" />
            {isLoading ? "Consultando..." : "Enviar mensaje"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
