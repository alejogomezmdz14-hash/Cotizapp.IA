import Link from "next/link";
import { Camera, FileOutput, FileText, Send, Zap } from "lucide-react";

import { LandingNavbar } from "@/components/layout/landing-navbar";

const features = [
  {
    icon: FileText,
    title: "Catálogo propio",
    description: "Tus ítems listos para cotizar",
  },
  {
    icon: Camera,
    title: "Escanear facturas",
    description: "De la foto a los ítems en segundos",
  },
  {
    icon: FileOutput,
    title: "PDF con tu marca",
    description: "Profesional, listo para WhatsApp",
  },
] as const;

const heroChips = [
  { icon: Zap, label: "Listo en 30 segundos" },
  { icon: FileOutput, label: "PDF con tu marca" },
  { icon: Send, label: "Enviá por WhatsApp" },
] as const;

export default function HomePage() {
  return (
    <main className="dark min-h-screen bg-[rgb(var(--background-rgb))] text-white">
      <LandingNavbar />
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-24">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 38%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 38%, black 40%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[34%] h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--accent-rgb)/0.14)] blur-[120px]"
          aria-hidden
        />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[rgb(var(--surface-rgb))] px-3 py-1.5 text-[11px] font-medium tracking-wide text-[rgb(var(--text-secondary-rgb))]">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent-rgb))]" />
            Cotizaciones profesionales con IA
          </span>

          <h1 className="text-balance text-[2.6rem] font-extrabold leading-[1.04] tracking-tight text-white sm:text-[4rem]">
            Cotizá. Enviá.
            <br />
            Cobrá.
          </h1>

          <p className="mt-5 max-w-sm text-base leading-relaxed text-[rgb(var(--text-secondary-rgb))] sm:max-w-xl sm:text-lg">
            Hacé cotizaciones con tu logo en menos de un minuto y mandáselas a
            tu cliente por WhatsApp. Sin saber de computadoras.
          </p>

          <Link
            href="/sign-up"
            className="mt-9 inline-flex h-[3.25rem] w-full max-w-xs items-center justify-center rounded-2xl bg-[rgb(var(--accent-rgb))] px-6 text-base font-bold text-black shadow-[0_8px_30px_rgb(var(--accent-rgb)/0.25)] transition hover:bg-[rgb(var(--accent-rgb)/0.9)] active:scale-[0.98]"
          >
            Empezar gratis
          </Link>

          <p className="mt-3 text-[13px] text-[rgb(var(--text-secondary-rgb))]">
            Sin tarjeta · listo en menos de un minuto
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {heroChips.map((chip) => {
              const ChipIcon = chip.icon;
              return (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[rgb(var(--surface-rgb))] px-3 py-1.5 text-xs text-[rgb(var(--text-secondary-rgb))]"
                >
                  <ChipIcon
                    className="h-3.5 w-3.5 text-[rgb(var(--accent-rgb))]"
                    strokeWidth={2}
                  />
                  {chip.label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/6 bg-[rgb(var(--background-rgb))] px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div key={feature.title} className="text-center">
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[rgb(var(--surface-rgb))] text-[rgb(var(--accent-rgb))]"
                  aria-hidden
                >
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h2 className="text-base font-semibold text-white">{feature.title}</h2>
                <p className="mt-2 text-sm text-[rgb(var(--text-secondary-rgb))]">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-white/6 bg-[rgb(var(--background-rgb))] px-6 py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="text-[2.5rem] font-extrabold tracking-tight text-white">
            Empezá hoy. Gratis.
          </h2>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex h-14 min-w-[14rem] items-center justify-center rounded-xl bg-[rgb(var(--accent-rgb))] px-8 text-base font-bold text-black transition hover:bg-[rgb(var(--accent-rgb)/0.9)]"
          >
            Crear mi cuenta
          </Link>
        </div>
      </section>
    </main>
  );
}
