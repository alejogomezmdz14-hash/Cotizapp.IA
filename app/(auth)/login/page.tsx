import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const loginHighlights = [
  "Acceso rápido para continuar con tu configuración inicial.",
  "Misma base visual que el panel para que todo se sienta conectado.",
  "Flujo simple y enfocado desde mobile hasta escritorio.",
];

export default function LoginPage() {
  return (
    <main className="shell-backdrop flex min-h-screen items-center bg-background px-4 py-10 sm:px-6">
      <section className="mx-auto w-full max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
          <div className="order-2 shell-panel-strong shell-highlight flex flex-col justify-between gap-6 p-6 sm:p-8 lg:order-1">
            <div className="space-y-4">
              <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Acceso seguro
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Entrá a Cotizapp con una experiencia más clara y consistente.
                </h1>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                  Un solo acceso para seguir con la configuración de tu negocio
                  y volver rápido al panel principal.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {loginHighlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-3xl border border-token bg-background/70 px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {highlight}
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 shell-panel-strong p-6 sm:p-8 lg:order-2">
            <div className="mx-auto flex w-full max-w-md flex-col gap-6">
              <div className="space-y-3">
                <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Google Sign-In
                </span>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Entrá a Cotizapp
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Usá tu cuenta de Google para ingresar y terminar la
                    configuración inicial de tu negocio.
                  </p>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-token bg-background/75 p-5 shadow-sm">
                <GoogleSignInButton />
              </div>

              <div className="rounded-[1.75rem] border border-token bg-background/60 px-4 py-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  Si tu perfil todavía no está completo, te vamos a guiar al
                  onboarding antes de entrar al panel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
