import Link from "next/link";
import {
  BadgeCheck,
  Clock3,
  FileText,
  Send,
  TrendingUp,
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
import { formatCurrencyAmount, formatDateTime } from "@/lib/formatting";
import { getProfile, requireUser } from "@/lib/profile";
import { getQuotations } from "@/lib/quotations";
import { cn } from "@/lib/utils";

function formatStatusLabel(value: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "draft":
      return "Borrador";
    case "pending":
      return "Enviada";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    default:
      return "Sin estado";
  }
}

function getStatusBadgeClassName(value: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "accepted":
      return "border-primary/40 bg-primary/10 text-primary";
    case "rejected":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "pending":
      return "border-token bg-surface-2 text-foreground";
    default:
      return "border-token bg-background text-foreground";
  }
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, profile, quotations] = await Promise.all([
    getDashboardStats(user.id),
    getProfile(user.id),
    getQuotations(user.id),
  ]);
  const { quotationMetricCards } = buildDashboardPageCards(
    stats,
    profile?.currency ?? null,
  );

  const quotationMetricIcons = {
    totalQuotedThisMonth: TrendingUp,
    sentQuotations: Send,
    acceptedQuotations: BadgeCheck,
    pendingQuotations: Clock3,
  } as const;
  const recentQuotations = quotations.slice(0, 5);
  const panelClassName =
    "shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6";
  const statCardClassName =
    "!rounded-[1.75rem] !border-token !bg-background/75 !shadow-[0_20px_45px_-32px_rgba(15,17,23,0.45)]";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className="shell-panel-strong shell-highlight overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
        <div className="space-y-5">
          <span className="inline-flex w-fit rounded-full border border-token bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Dashboard
          </span>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Mira el estado comercial del mes en una sola vista
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Los cuatro KPI principales quedan arriba y debajo tienes tus
              cotizaciones recientes para entrar rápido a seguimiento, duplicación o
              edición.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/cotizaciones/nueva">Crear cotización</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/cotizaciones">Ver historial</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className={panelClassName}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Métricas clave
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
                    <FileText className="h-4 w-4 text-muted-foreground" />
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className={panelClassName}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Recientes
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Cotizaciones recientes
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Revisa los últimos movimientos sin duplicar métricas ni salir del
              dashboard.
            </p>
          </div>
          <Button asChild variant="outline" className="bg-background/75">
            <Link href="/cotizaciones">Abrir cotizaciones</Link>
          </Button>
        </div>

        {recentQuotations.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">
              Todavía no tienes cotizaciones
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Crea la primera cotización para ver el historial reciente desde este
              dashboard.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {recentQuotations.map((quotation) => (
              <Card key={quotation.id} className={cn(statCardClassName, "!bg-background/80")}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {quotation.number}
                      </span>
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadgeClassName(
                          quotation.status,
                        )}`}
                      >
                        {formatStatusLabel(quotation.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {quotation.client_name?.trim() || "Cliente sin asignar"}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Creada el {formatDateTime(quotation.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrencyAmount(quotation.total, profile?.currency ?? null)}
                    </p>
                    <Button asChild variant="outline" className="bg-background/75">
                      <Link href="/cotizaciones">Ver detalle</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
