import Link from "next/link";

import { CotizappLogo } from "@/components/brand/cotizapp-logo";

export function LandingNavbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[rgb(var(--background-rgb)/0.9)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="bg-transparent" aria-label="Ir al inicio de Cotizapp">
          <CotizappLogo variant="on-dark" width={140} priority />
        </Link>

        <Link
          href="/sign-in"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[rgb(var(--accent-rgb))] px-4 text-sm font-semibold text-black transition hover:bg-[rgb(var(--accent-rgb)/0.9)]"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}
