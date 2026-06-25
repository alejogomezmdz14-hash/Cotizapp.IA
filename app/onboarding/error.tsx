"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type OnboardingErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function OnboardingError({ error, reset }: OnboardingErrorProps) {
  useEffect(() => {
    console.error("[onboarding]", error);
  }, [error]);

  return (
    <main className="shell-backdrop flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="shell-panel-strong w-full max-w-lg space-y-5 border border-token p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              No pudimos cargar el onboarding
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Tuvimos un problema preparando tu cuenta. No es nada que hayas
              hecho mal. Probá de nuevo en unos segundos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={reset}>
            Reintentar
          </Button>
          <Button variant="outline" asChild>
            <Link href="/sign-in">Volver al inicio de sesión</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
