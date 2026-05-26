import Link from "next/link";

import { Button } from "@/components/ui/button";

const landingHighlights = [
  "Catalogo y clientes listos para operar",
  "Cotizaciones con una presencia mas profesional",
  "Base preparada para crecer con IA",
];

const landingSignals = [
  { label: "Experiencia", value: "Panel claro desde el primer ingreso" },
  { label: "Enfoque", value: "Menos friccion en la operacion comercial" },
];

export default function HomePage() {
  return (
    <main className="shell-backdrop min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-10">
          <div className="flex flex-col justify-center gap-8">
            <div className="space-y-5">
              <span className="inline-flex w-fit rounded-full border border-token bg-background/80 px-3 py-1 text-sm text-muted-foreground shadow-sm backdrop-blur">
                PWA para cotizaciones profesionales
              </span>
              <div className="space-y-4">
                <h1 className="text-balance max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Cotizapp te ayuda a cotizar con tu marca y sin perder tiempo.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                  Catalogo, clientes, cotizaciones y una base lista para crecer
                  con IA.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="px-6">
                <Link href="/login">Entrar a Cotizapp</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="px-6">
                <Link href="/dashboard">Ver estructura interna</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {landingHighlights.map((highlight) => (
                <div
                  key={highlight}
                  className="shell-panel rounded-3xl px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {highlight}
                </div>
              ))}
            </div>
          </div>

          <aside className="shell-panel-strong shell-highlight flex flex-col justify-between gap-6 p-6 sm:p-8">
            <div className="space-y-4">
              <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Sistema listo para vender
              </span>
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Una presencia mas solida para tu operacion diaria.
                </h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                  Entradas claras, panel mas ordenado y puntos de accion mas
                  visibles para que tu equipo encuentre rapido que hacer.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {landingSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-3xl border border-token bg-background/70 px-4 py-4"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {signal.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {signal.value}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
