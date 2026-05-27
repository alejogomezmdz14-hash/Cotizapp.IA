"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import {
  cancelAllPendingTasks,
  hasUnsavedDraft,
} from "@/lib/pending-tasks";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    const draftWarning = hasUnsavedDraft()
      ? "\n\nTenés un borrador con cambios sin guardar. Si salís ahora, vas a perder ese progreso."
      : "";

    const confirmed = window.confirm(
      `Vas a cerrar sesión.${draftWarning}\n\n¿Querés continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setIsPending(true);
    cancelAllPendingTasks();

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("No pudimos cerrar sesión. Intentá de nuevo.");
        toast({
          title: "No se pudo cerrar sesión",
          description: "Intentá nuevamente en unos segundos.",
          variant: "error",
        });
        setIsPending(false);
        return;
      }

      window.location.assign("/login");
    } catch {
      setErrorMessage("No pudimos cerrar sesión. Intentá de nuevo.");
      toast({
        title: "No se pudo cerrar sesión",
        description: "Intentá nuevamente en unos segundos.",
        variant: "error",
      });
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        className="rounded-[1rem] border-token bg-background/80 text-foreground hover:bg-background hover:text-foreground"
        onClick={handleSignOut}
        disabled={isPending}
      >
        {isPending ? "Saliendo..." : "Salir"}
      </Button>
      {errorMessage ? (
        <p className="text-right text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
