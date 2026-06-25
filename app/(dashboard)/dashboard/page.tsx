import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { DashboardMonthlyChart } from "@/components/dashboard/dashboard-monthly-chart";
import { EMPTY_DASHBOARD_STATS, getDashboardStats } from "@/lib/dashboard";
import {
  getDashboardPeriodSummary,
  getPreviousPeriodNow,
  type DashboardPeriodSummary as PeriodSummary,
} from "@/lib/dashboard-period";
import {
  emptyQuotationStatusCounts,
  getDashboardStatusCounts,
} from "@/lib/dashboard-status-counts";
import { computeVariationPercent } from "@/lib/dashboard-variation";
import { formatDisplayName } from "@/lib/entity-normalization";
import { formatCurrencyAmount, formatDateTime } from "@/lib/formatting";
import { getProfile, requireUser } from "@/lib/profile";
import { getQuotations } from "@/lib/quotations";
import {
  formatQuotationStatusLabel,
  getQuotationStatusBadgeClassName,
} from "@/lib/quotation-status";
import { cn } from "@/lib/utils";

const EMPTY_PERIOD_SUMMARY: PeriodSummary = {
  accepted: 0,
  spent: 0,
  net: 0,
  canCalculateNet: false,
};

export default async function DashboardPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const currency = profile?.currency ?? null;
  const prevWeekNow = getPreviousPeriodNow("week");
  const prevMonthNow = getPreviousPeriodNow("month");

  const [
    stats,
    quotations,
    weekSummary,
    monthSummary,
    prevWeekSummary,
    prevMonthSummary,
    weekStatus,
    monthStatus,
  ] = await Promise.all([
    getDashboardStats(user.id, currency).catch(() => EMPTY_DASHBOARD_STATS),
    getQuotations(user.id, { limit: 5 }).catch(() => []),
    getDashboardPeriodSummary(user.id, currency, "week").catch(() => EMPTY_PERIOD_SUMMARY),
    getDashboardPeriodSummary(user.id, currency, "month").catch(() => EMPTY_PERIOD_SUMMARY),
    getDashboardPeriodSummary(user.id, currency, "week", prevWeekNow).catch(() => EMPTY_PERIOD_SUMMARY),
    getDashboardPeriodSummary(user.id, currency, "month", prevMonthNow).catch(() => EMPTY_PERIOD_SUMMARY),
    getDashboardStatusCounts(user.id, "week").catch(() => emptyQuotationStatusCounts()),
    getDashboardStatusCounts(user.id, "month").catch(() => emptyQuotationStatusCounts()),
  ]);

  const acceptedSeries = stats.monthlyComparison.map((point) => point.accepted);
  const expensesSeries = stats.monthlyComparison.map((point) => point.expenses);

  const weekBundle = {
    tiles: {
      accepted: weekSummary.accepted,
      spent: weekSummary.spent,
      net: weekSummary.net,
      canCalculateNet: weekSummary.canCalculateNet,
      pendingCount: weekStatus.pending,
      acceptedVariation: computeVariationPercent(weekSummary.accepted, prevWeekSummary.accepted),
      spentVariation: computeVariationPercent(weekSummary.spent, prevWeekSummary.spent),
    },
    statusCounts: weekStatus,
  };
  const monthBundle = {
    tiles: {
      accepted: monthSummary.accepted,
      spent: monthSummary.spent,
      net: monthSummary.net,
      canCalculateNet: monthSummary.canCalculateNet,
      pendingCount: monthStatus.pending,
      acceptedVariation: computeVariationPercent(monthSummary.accepted, prevMonthSummary.accepted),
      spentVariation: computeVariationPercent(monthSummary.spent, prevMonthSummary.spent),
    },
    statusCounts: monthStatus,
  };

  const recentQuotations = quotations.slice(0, 5);
  const greetingName =
    formatDisplayName(profile?.first_name ?? null) ||
    formatDisplayName(profile?.business_name ?? null) ||
    null;

  const panelClassName = "shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6";
  const statCardClassName = "!rounded-md !border-token !bg-background/75 !shadow-none";

  return (
    <div className="space-y-5 pb-20 lg:space-y-6">
      <section className={panelClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-tight">
              {greetingName ? `Hola, ${greetingName} 👋` : "Hola 👋"}
            </h3>
            <p className="text-sm text-muted-foreground">Así va tu negocio</p>
          </div>
          <Button asChild variant="outline" className="min-h-12 bg-background/75">
            <Link href="/cotizaciones">Ver mis cotizaciones</Link>
          </Button>
        </div>
      </section>

      <DashboardOverview
        week={weekBundle}
        month={monthBundle}
        currency={currency}
        acceptedSeries={acceptedSeries}
        expensesSeries={expensesSeries}
      />

      <section className={panelClassName}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight">Cotizado vs gastos</h3>
          <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
        </div>
        <DashboardMonthlyChart data={stats.monthlyComparison} currency={currency} />
      </section>

      <section className={panelClassName}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-tight">Cotizaciones recientes</h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Tus últimas cotizaciones de un vistazo.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-12 bg-background/75">
            <Link href="/cotizaciones">Ver todas</Link>
          </Button>
        </div>

        {recentQuotations.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-10 text-center">
            <p className="text-lg font-semibold text-foreground">
              Hagamos tu primera cotización
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Es rápido y queda con tu logo. La armás y se la mandás a tu cliente por WhatsApp.
            </p>
            <div className="mt-6 flex justify-center">
              <Button asChild className="min-h-12">
                <Link href="/cotizaciones/nueva">Crear mi primera cotización</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {recentQuotations.map((quotation) => (
              <Card key={quotation.id} className={cn(statCardClassName, "!bg-background/80")}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
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
                      <p className="break-words text-lg font-semibold text-foreground">
                        {formatDisplayName(quotation.client_name) || "Cliente sin asignar"}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Creada el {formatDateTime(quotation.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrencyAmount(quotation.total, currency)}
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
