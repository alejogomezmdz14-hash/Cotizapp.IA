import Link from "next/link";
import { Camera, FileOutput, FileText } from "lucide-react";

import { LandingNavbar } from "@/components/layout/landing-navbar";

const features = [
  {
    icon: FileText,
    title: "Catalogo propio",
    description: "Tus items listos para cotizar",
  },
  {
    icon: Camera,
    title: "Escanear facturas",
    description: "Foto a items en segundos",
  },
  {
    icon: FileOutput,
    title: "PDF con tu marca",
    description: "Profesional, listo para WhatsApp",
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      <LandingNavbar />
      <section className="relative flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-6 pb-20 pt-28">
        <div
          className="pointer-events-none absolute inset-0 bg-[#0A0A0F]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <span className="mb-8 inline-flex rounded-full border border-white/10 bg-[#16161d] px-3 py-1 text-[11px] font-medium tracking-wide text-[#8b949e]">
            Cotizaciones profesionales con IA
          </span>

          <h1 className="text-balance text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[4rem]">
            Cotiza. Envia.
            <br />
            Cobra.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-[#8b949e]">
            Para plomeros, electricistas, jardineros y revendedores.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex h-12 min-w-[11rem] items-center justify-center rounded-xl bg-[#00E5A0] px-6 text-sm font-bold text-[#000000] transition hover:bg-[#00cc8f]"
            >
              Empezar gratis
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 min-w-[11rem] items-center justify-center rounded-xl border border-white/20 bg-transparent px-6 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
            >
              Ver demo
            </Link>
          </div>

          <p className="mt-10 text-[13px] text-[#8b949e]">
            500+ negocios ya cotizan con Cotizapp
          </p>
        </div>
      </section>

      <section className="border-t border-white/6 bg-[#0A0A0F] px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div key={feature.title} className="text-center">
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#16161d] text-[#00E5A0]"
                  aria-hidden
                >
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h2 className="text-base font-semibold text-white">{feature.title}</h2>
                <p className="mt-2 text-sm text-[#8b949e]">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-white/6 bg-[#0A0A0F] px-6 py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="text-[2.5rem] font-extrabold tracking-tight text-white">
            Empieza hoy. Gratis.
          </h2>
          <Link
            href="/login"
            className="mt-8 inline-flex h-14 min-w-[14rem] items-center justify-center rounded-xl bg-[#00E5A0] px-8 text-base font-bold text-[#000000] transition hover:bg-[#00cc8f]"
          >
            Crear mi cuenta
          </Link>
        </div>
      </section>
    </main>
  );
}
