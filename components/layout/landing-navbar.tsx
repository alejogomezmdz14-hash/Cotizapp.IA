import Link from "next/link";

import { CotizappLogo } from "@/components/brand/cotizapp-logo";

export function LandingNavbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[rgb(var(--background-rgb)/0.9)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="bg-transparent" aria-label="Ir al inicio de Cotizapp">
          {/* mix-blend-lighten hace desaparecer el fondo negro horneado del
              logo sobre la barra oscura, sin alterar el verde ni el blanco. */}
          <CotizappLogo
            variant="on-dark"
            width={132}
            priority
            className="mix-blend-lighten"
          />
        </Link>

        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center justify-center rounded-full bg-[rgb(var(--accent-rgb))] px-5 text-sm font-semibold text-black transition hover:bg-[rgb(var(--accent-rgb)/0.9)] active:scale-95"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}
