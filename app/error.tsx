"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/log";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Error boundary raíz. Antes no existía: `requireUser()` llama a
 * `ensureProfileForClerkUser` sin try/catch (lib/profile.ts:162), así que un
 * fallo de la RPC o de una política RLS le mostraba al usuario un 500 crudo de
 * Next en inglés.
 */
export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    // describeError se queda solo con name y message: nunca el objeto entero,
    // que podría arrastrar datos del usuario (ver lib/log.ts).
    console.error("[app]", { ...describeError(error), digest: error.digest ?? null });
  }, [error]);

  return (
    <main className="shell-backdrop flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="shell-panel-strong w-full max-w-lg space-y-5 border border-token p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              Algo se rompió de nuestro lado
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              No es nada que hayas hecho mal, y no perdiste nada de lo que ya
              habías guardado. Probá de nuevo en unos segundos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" className="min-h-12" onClick={reset}>
            Reintentar
          </Button>
          <Button variant="outline" className="min-h-12 bg-background/75" asChild>
            <Link href="/dashboard">Ir al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
