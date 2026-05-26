"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    setIsLoading(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });

    if (error) {
      setIsLoading(false);
      setErrorMessage("No pudimos iniciar sesión con Google. Intentá de nuevo.");
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={handleSignIn}
        disabled={isLoading}
        size="lg"
        className="w-full rounded-[1rem]"
      >
        {isLoading ? "Redirigiendo con Google..." : "Continuar con Google"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
