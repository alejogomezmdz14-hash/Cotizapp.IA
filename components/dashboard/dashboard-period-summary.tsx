"use client";

import Link from "next/link";
import { useState } from "react";

import {
  type DashboardPeriod,
  type DashboardPeriodSummary as PeriodSummary,
} from "@/lib/dashboard-period";
import { formatCurrencyAmount } from "@/lib/formatting";
import { cn } from "@/lib/utils";

type DashboardPeriodSummaryProps = {
  week: PeriodSummary;
  month: PeriodSummary;
  currency: string | null;
};

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mes" },
];

export function DashboardPeriodSummary({
  week,
  month,
  currency,
}: DashboardPeriodSummaryProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const active = period === "week" ? week : month;
  const spentRatio =
    active.accepted > 0
      ? Math.min(100, Math.round((active.spent / active.accepted) * 100))
      : 0;

  return (
    <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-semibold tracking-tight">
          Resumen del período
        </h3>
        <div
          role="tablist"
          aria-label="Período del resumen"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              setPeriod((current) => (current === "week" ? "month" : "week"));
            }
          }}
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
                tabIndex={selected ? 0 : -1}
                onClick={() => setPeriod(option.id)}
                className={cn(
                  "min-h-9 rounded-full px-4 text-sm font-medium transition",
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
          <p className="text-sm text-muted-foreground">Aceptado</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrencyAmount(active.accepted, currency)}
          </p>
        </div>
        <div className="rounded-md border border-orange-500/30 bg-orange-500/8 p-4">
          <p className="text-sm text-muted-foreground">Gastado</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrencyAmount(active.spent, currency)}
          </p>
        </div>
        <div className="rounded-md border border-token bg-background/75 p-4">
          <p className="text-sm text-muted-foreground">Ganancia neta</p>
          {active.canCalculateNet ? (
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatCurrencyAmount(active.net, currency)}
            </p>
          ) : (
            <Link
              href="/gastos"
              className="mt-2 inline-block text-sm font-medium text-accent-token"
            >
              Registrá gastos para verla →
            </Link>
          )}
        </div>
      </div>

      {active.accepted > 0 && active.canCalculateNet ? (
        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-orange-500/70"
              style={{ width: `${spentRatio}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Gastaste el {spentRatio}% de lo que aceptaste{" "}
            {period === "week" ? "esta semana" : "este mes"}.
          </p>
        </div>
      ) : null}
    </section>
  );
}
