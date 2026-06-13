"use client";

import { useUser } from "@clerk/nextjs";
import { Clock, Mail } from "lucide-react";

import { CotizappLogo } from "@/components/brand/cotizapp-logo";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default function WaitlistPage() {
  const { user, isLoaded } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  return (
    <main className="shell-backdrop flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <CotizappLogo variant="auto" width={150} priority />
        </div>

        <div className="shell-panel-strong space-y-5 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--accent-rgb)/0.12)] text-accent-token">
            <Clock className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Estás en la lista de espera
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Ya tenés tu cuenta creada. Estamos revisando los accesos y en
              menos de 24 horas te llega un email cuando el tuyo esté listo.
            </p>
          </div>

          {isLoaded && email ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-token bg-background/70 px-4 py-3 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-accent-token" />
              <span className="truncate font-medium text-foreground">{email}</span>
            </div>
          ) : null}

          <p className="text-xs leading-5 text-muted-foreground">
            Cuando activemos tu acceso, cerrá sesión y volvé a entrar para que se
            aplique.
          </p>

          <div className="pt-1">
            <SignOutButton className="w-full justify-center" />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿Entraste con la cuenta equivocada? Cerrá sesión y probá con otra.
        </p>
      </div>
    </main>
  );
}
