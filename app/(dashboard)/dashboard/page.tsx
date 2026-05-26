import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  FileText,
  MessageSquare,
  Package,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardStats } from "@/lib/dashboard";
import { buildDashboardPageCards } from "@/lib/dashboard-page";
import { getProfile, requireUser } from "@/lib/profile";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, profile] = await Promise.all([
    getDashboardStats(user.id),
    getProfile(user.id),
  ]);
  const { quotationMetricCards, summaryCards } = buildDashboardPageCards(
    stats,
    profile?.currency ?? null,
  );

  const quotationMetricIcons = {
    totalQuotedThisMonth: TrendingUp,
    sentQuotations: Send,
    acceptedQuotations: BadgeCheck,
    pendingQuotations: Clock3,
  } as const;

  const summaryIcons = {
    quotations: FileText,
    clients: Users,
    catalogItems: Package,
  } as const;

  const heroMetric = quotationMetricCards[0];
  const heroSummary = summaryCards[0];
  const panelClassName =
    "shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6";
  const statCardClassName =
    "!rounded-[1.75rem] !border-token !bg-background/75 !shadow-[0_20px_45px_-32px_rgba(15,17,23,0.45)]";

  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] xl:items-end">
          <div className="space-y-5">
            <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Panel general
            </span>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Operacion de cotizaciones con foco y mejor lectura visual
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Sigue el ritmo comercial del mes y entra rapido a las secciones
                clave de Cotizapp desde una superficie mas clara y ordenada.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/cotizaciones/nueva">Crear una cotizacion</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/cotizaciones">Ver cotizaciones</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[1.75rem] border border-token bg-background/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {heroMetric.title}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {heroMetric.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {heroMetric.description}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-token bg-background/60 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {heroSummary.title}
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">
                {heroSummary.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {heroSummary.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={panelClassName}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Metricas clave
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Estado de tus cotizaciones
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Los indicadores principales se renderizan directo desde tu resumen
              operativo para ayudarte a priorizar.
            </p>
          </div>
          <Link
            href="/cotizaciones"
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Ver cotizaciones
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quotationMetricCards.map((card, index) => {
            const Icon = quotationMetricIcons[card.id];

            return (
              <Card
                key={card.id}
                className={cn(
                  statCardClassName,
                  index === 0 &&
                    "!border-[rgb(var(--accent-rgb)/0.3)] !bg-[rgb(var(--accent-rgb)/0.08)]",
                )}
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={cn(
                        "rounded-2xl border p-3",
                        index === 0
                          ? "border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.12)] text-accent-token"
                          : "border-token bg-background/80 text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <Link
                      href={card.href}
                      className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      Ver mas
                    </Link>
                  </div>
                  <div className="space-y-1">
                    <CardDescription>{card.title}</CardDescription>
                    <CardTitle
                      className={index === 0 ? "text-3xl lg:text-4xl" : "text-4xl"}
                    >
                      {card.value}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {card.description}
                  </p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className={panelClassName}>
        <div className="mb-5 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Base de cuenta
          </p>
          <h3 className="text-xl font-semibold tracking-tight">
            Base de tu cuenta
          </h3>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Manten a mano el volumen total de trabajo, tus clientes y el
            catalogo cargado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = summaryIcons[card.id];

            return (
              <Card key={card.id} className={statCardClassName}>
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-2xl border border-token bg-background/80 p-3">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <Link
                      href={card.href}
                      className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      Ver mas
                    </Link>
                  </div>
                  <div className="space-y-1">
                    <CardDescription>{card.title}</CardDescription>
                    <CardTitle className="text-4xl">{card.value}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {card.description}
                  </p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className={cn(statCardClassName, "!bg-background/80")}>
          <CardHeader>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Siguiente accion
              </p>
              <CardTitle className="text-xl">Siguiente paso recomendado</CardTitle>
            </div>
            <CardDescription>
              Empeza por crear una cotizacion nueva o revisar tu informacion
              cargada.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/cotizaciones/nueva">Nueva cotizacion</Link>
            </Button>
            <Button asChild variant="outline" className="bg-background/75">
              <Link href="/catalogo">Abrir catalogo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={cn(statCardClassName, "!bg-background/80")}>
          <CardHeader>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Acceso directo
              </p>
              <CardTitle className="text-xl">Chat IA</CardTitle>
            </div>
            <CardDescription>
              El espacio conversacional ya tiene su punto de entrada para las
              siguientes tareas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="bg-background/75">
              <Link href="/chat" className="inline-flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Ir al chat
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
