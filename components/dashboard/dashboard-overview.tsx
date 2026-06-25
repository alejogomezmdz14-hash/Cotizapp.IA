// components/dashboard/dashboard-overview.tsx
"use client";

import { useState } from "react";

import {
  DashboardStatTiles,
  type StatTilesData,
} from "@/components/dashboard/dashboard-stat-tiles";
import { DashboardStatusDonut } from "@/components/dashboard/dashboard-status-donut";
import type { QuotationStatusCounts } from "@/lib/dashboard-status-counts";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { cn } from "@/lib/utils";

type PeriodBundle = {
  tiles: StatTilesData;
  statusCounts: QuotationStatusCounts;
};

type DashboardOverviewProps = {
  week: PeriodBundle;
  month: PeriodBundle;
  currency: string | null;
  acceptedSeries: number[];
  expensesSeries: number[];
};

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: "week", label: "Semana" },
  { id: "month", label: "Este mes" },
];

export function DashboardOverview({
  week,
  month,
  currency,
  acceptedSeries,
  expensesSeries,
}: DashboardOverviewProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const active = period === "week" ? week : month;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight">Tu negocio de un vistazo</h3>
        <div
          role="tablist"
          aria-label="Período del tablero"
          className="inline-flex rounded-full border border-token bg-background/75 p-1"
        >
          {PERIOD_OPTIONS.map((option) => {
            const selected = option.id === period;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setPeriod(option.id)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-sm font-medium transition",
                  selected
                    ? "bg-accent-token text-black"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <DashboardStatTiles
        data={active.tiles}
        currency={currency}
        acceptedSeries={acceptedSeries}
        expensesSeries={expensesSeries}
      />

      <DashboardStatusDonut counts={active.statusCounts} period={period} />
    </div>
  );
}
