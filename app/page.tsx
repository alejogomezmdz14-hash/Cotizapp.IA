import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-6 py-16">
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex rounded-full border border-token px-3 py-1 text-sm text-muted-foreground">
            PWA para cotizaciones profesionales
          </span>
          <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
            Cotizapp te ayuda a cotizar con tu marca y sin perder tiempo.
          </h1>
          <p className="text-lg text-muted-foreground">
            Catalogo, clientes, cotizaciones y una base lista para crecer con IA.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="bg-accent-token text-black hover:bg-accent-hover">
            <Link href="/login">Entrar a Cotizapp</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-token bg-transparent text-foreground"
          >
            <Link href="/dashboard">Ver estructura interna</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
