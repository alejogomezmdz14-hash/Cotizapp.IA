import Link from "next/link";

import { CotizappLogo } from "@/components/brand/cotizapp-logo";

export function LandingNavbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0A0A0F]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="bg-transparent" aria-label="Ir al inicio de Cotizapp">
          <CotizappLogo variant="on-dark" width={140} priority />
        </Link>

        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#00E5A0] px-4 text-sm font-semibold text-black transition hover:bg-[#00cc8f]"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}
