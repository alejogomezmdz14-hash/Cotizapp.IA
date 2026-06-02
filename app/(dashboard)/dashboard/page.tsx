import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { DashboardMetricCards } from "@/components/dashboard/dashboard-metric-cards";
import { DashboardMonthlyChart } from "@/components/dashboard/dashboard-monthly-chart";
import { EMPTY_DASHBOARD_STATS, getDashboardStats } from "@/lib/dashboard";
import { buildDashboardPageCards } from "@/lib/dashboard-page";
import { formatExpenseTotalsByCurrency } from "@/lib/formatting";
import { formatDisplayName } from "@/lib/entity-normalization";
import { formatCurrencyAmount, formatDateTime } from "@/lib/formatting";
import { getProfile, requireUser } from "@/lib/profile";
import { getQuotations } from "@/lib/quotations";
import {
  formatQuotationStatusLabel,
  getQuotationStatusBadgeClassName,
} from "@/lib/quotation-status";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const currency = profile?.currency ?? null;
  const [stats, quotations] = await Promise.all([
    getDashboardStats(user.id, currency).catch(() => EMPTY_DASHBOARD_STATS),
    getQuotations(user.id, { limit: 5 }).catch(() => []),
  ]);
  const { quotationMetricCards } = buildDashboardPageCards(
    stats,
    profile?.currency ?? null,
  );

  const recentQuotations = quotations.slice(0, 5);
  const hasExpenses = stats.expensesByCurrency.length > 0;
  const expensesSummary = hasExpenses
    ? formatExpenseTotalsByCurrency(stats.expensesByCurrency)
    : formatCurrencyAmount(0, currency);
  const monthlySummary = [
    {
      label: "Aceptado este mes",
      value: formatCurrencyAmount(stats.acceptedQuotedThisMonth, currency),
    },
    {
      label: "Cobrado (lo que ya te pagaron)",
      value: formatCurrencyAmount(stats.collectedThisMonth, currency),
    },
    {
      label: "Gastos",
      value: expensesSummary,
    },
    {
      label: "Ganancia neta",
      value:
        hasExpenses && stats.canCalculateNetProfit
          ? formatCurrencyAmount(stats.netProfitThisMonth, currency)
          : formatCurrencyAmount(stats.acceptedQuotedThisMonth, currency),
      hint:
        hasExpenses && stats.canCalculateNetProfit
          ? undefined
          : "Sin gastos registrados",
    },
  ];
  const panelClassName = "shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6";
  const statCardClassName = "!rounded-md !border-token !bg-background/75 !shadow-none";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className={panelClassName}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="ui-shell-kicker">
              Tu resumen de hoy
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Estado de tus cotizaciones
            </h3>
          </div>
          <Button asChild variant="outline" className="min-h-12 bg-background/75">
            <Link href="/cotizaciones">Ver cotizaciones</Link>
          </Button>
        </div>

        <DashboardMetricCards
          cards={quotationMetricCards}
          netProfitThisMonth={stats.netProfitThisMonth}
        />
      </section>

      <section className={panelClassName}>
        <div className="mb-5 space-y-2">
          <p className="ui-shell-kicker">
            Este mes
          </p>
          <h3 className="text-xl font-semibold tracking-tight">
            Resumen financiero del mes
          </h3>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {monthlySummary.map((item) => (
            <div key={item.label} className="rounded-md border border-token/80 bg-background/70 p-4">
              <p className="ui-shell-kicker">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {item.value}
              </p>
              {"hint" in item && item.hint ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-md border border-token/80 bg-background/70 p-4 sm:p-5">
          <p className="mb-4 text-sm font-medium text-foreground">
            Cotizaciones vs gastos (últimos 6 meses)
          </p>
          <DashboardMonthlyChart
            data={stats.monthlyComparison}
            currency={currency}
          />
        </div>
      </section>

      <section className={panelClassName}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="ui-shell-kicker">
              Recientes
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              Cotizaciones recientes
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Tus últimas cotizaciones de un vistazo.
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
              Creá tu primera cotización para ver el historial reciente acá.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {recentQuotations.map((quotation) => (
              <Card key={quotation.id} className={cn(statCardClassName, "!bg-background/80")}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {quotation.number}
                      </span>
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getQuotationStatusBadgeClassName(
                          quotation.status,
                        )}`}
                      >
                        {formatQuotationStatusLabel(quotation.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {formatDisplayName(quotation.client_name) || "Cliente sin asignar"}
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
                      <Link href={`/cotizaciones/${quotation.id}`}>Ver detalle</Link>
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
