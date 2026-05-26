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

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <span className="inline-flex w-fit rounded-full border border-token px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Panel general
        </span>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">
              Operacion de cotizaciones
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Sigue el ritmo comercial del mes y entra rapido a las secciones
              clave de Cotizapp.
            </p>
          </div>

          <Button
            asChild
            className="bg-accent-token text-black hover:bg-accent-hover"
          >
            <Link href="/cotizaciones/nueva">Crear una cotizacion</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">
              Estado de tus cotizaciones
            </h3>
            <p className="text-sm text-muted-foreground">
              Los indicadores principales se renderizan directo desde tu resumen
              operativo.
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
                className={
                  index === 0
                    ? "border-accent-token/50 bg-surface shadow-sm"
                    : "border-token bg-surface shadow-sm"
                }
              >
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={
                        index === 0
                          ? "rounded-2xl bg-accent-token/10 p-3 text-accent-token"
                          : "rounded-2xl bg-surface-2 p-3 text-foreground"
                      }
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

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">
            Base de tu cuenta
          </h3>
          <p className="text-sm text-muted-foreground">
            Manten a mano el volumen total de trabajo, tus clientes y el
            catalogo cargado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = summaryIcons[card.id];

            return (
              <Card key={card.id} className="border-token bg-surface shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-2xl bg-surface-2 p-3">
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
        <Card className="border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Siguiente paso recomendado</CardTitle>
            <CardDescription>
              Empeza por crear una cotizacion nueva o revisar tu informacion
              cargada.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="bg-accent-token text-black hover:bg-accent-hover"
            >
              <Link href="/cotizaciones/nueva">Nueva cotizacion</Link>
            </Button>
            <Button asChild variant="outline" className="border-token bg-transparent">
              <Link href="/catalogo">Abrir catalogo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-token bg-surface shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Chat IA</CardTitle>
            <CardDescription>
              El espacio conversacional ya tiene su punto de entrada para las
              siguientes tareas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-token bg-transparent">
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
