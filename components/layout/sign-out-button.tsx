"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";
import {
  cancelAllPendingTasks,
  hasUnsavedDraft,
} from "@/lib/pending-tasks";
import { createClient } from "@/lib/supabase/client";

type SignOutButtonProps = {
  className?: string;
  menuItem?: boolean;
};

export function SignOutButton({ className, menuItem = false }: SignOutButtonProps) {
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

  if (menuItem) {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
          className,
        )}
        onClick={handleSignOut}
        disabled={isPending}
      >
        Cerrar sesión
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        className={cn(
          "rounded-[1rem] border-token bg-background/80 text-foreground hover:bg-background hover:text-foreground",
          className,
        )}
        onClick={handleSignOut}
        disabled={isPending}
      >
        {isPending ? "Saliendo..." : "Cerrar sesión"}
      </Button>
      {errorMessage ? (
        <p className="text-right text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
