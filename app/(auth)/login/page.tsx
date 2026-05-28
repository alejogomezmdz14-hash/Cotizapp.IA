import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { CotizappLogo } from "@/components/brand/cotizapp-logo";

export default function LoginPage() {
  return (
    <main className="shell-backdrop flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-6">
      <section className="shell-panel-strong w-full max-w-md p-6 sm:p-8">
        <div className="mx-auto flex w-full flex-col gap-6">
          <div className="flex justify-center border-b border-token/70 pb-5">
            <CotizappLogo variant="auto" width={160} priority />
          </div>
          <div className="space-y-2 text-left">
            <p className="ui-shell-kicker">Acceso</p>
            <h1 className="text-3xl font-medium tracking-tight">Entrá a Cotizapp</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Usá tu cuenta de Google para ingresar.
            </p>
          </div>

          <div className="rounded-md border border-token bg-background/75 p-5 shadow-none">
            <GoogleSignInButton />
          </div>
        </div>
      </section>
    </main>
  );
}
