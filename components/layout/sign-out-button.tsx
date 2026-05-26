"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    setErrorMessage(null);
    setIsPending(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("No pudimos cerrar sesión. Intentá de nuevo.");
        setIsPending(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("No pudimos cerrar sesión. Intentá de nuevo.");
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
