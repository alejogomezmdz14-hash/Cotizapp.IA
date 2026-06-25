import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ActionHintProps = {
  children: ReactNode;
  /** "muted" para explicar por qué un botón está deshabilitado; "error" (rojo) para validaciones de campo. */
  tone?: "muted" | "error";
  className?: string;
};

/**
 * Patrón único de feedback de Cotizapp.
 *
 * Para acciones bloqueadas usamos siempre: botón `disabled` + un `ActionHint`
 * que dice qué falta (en vez de fallar en silencio). Para errores de validación
 * de un campo, usar `tone="error"`. Para errores de ejecución, usar el toast.
 */
export function ActionHint({ children, tone = "muted", className }: ActionHintProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "text-xs leading-5",
        tone === "error" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
