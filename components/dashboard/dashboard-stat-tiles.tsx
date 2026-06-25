// components/dashboard/dashboard-stat-tiles.tsx
import Link from "next/link";

import { Sparkline } from "@/components/dashboard/sparkline";
import { formatCurrencyAmount } from "@/lib/formatting";

export type StatTilesData = {
  accepted: number;
  spent: number;
  net: number;
  canCalculateNet: boolean;
  pendingCount: number;
  acceptedVariation: number | null;
  spentVariation: number | null;
};

type DashboardStatTilesProps = {
  data: StatTilesData;
  currency: string | null;
  acceptedSeries: number[];
  expensesSeries: number[];
};

function VariationText({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null || value === 0) {
    return <span className="text-xs text-muted-foreground">Sin cambios vs período anterior</span>;
  }
  const isUp = value > 0;
  const isGood = isUp === goodWhenUp;
  const color = isGood ? "text-accent-token" : "text-orange-600 dark:text-orange-300";
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {isUp ? "↑" : "↓"} {Math.abs(value)}% vs período anterior
    </span>
  );
}

export function DashboardStatTiles({
  data,
  currency,
  acceptedSeries,
  expensesSeries,
}: DashboardStatTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.08)] p-4">
        <p className="text-xs text-muted-foreground">Aceptado</p>
        <p className="mt-1 text-xl font-bold text-accent-token">
          {formatCurrencyAmount(data.accepted, currency)}
        </p>
        <VariationText value={data.acceptedVariation} goodWhenUp />
        <Sparkline values={acceptedSeries} color="rgb(var(--accent-rgb))" className="mt-2 h-6 w-full" />
      </div>

      <div className="rounded-2xl border border-token bg-background/75 p-4">
        <p className="text-xs text-muted-foreground">Gastos</p>
        <p className="mt-1 text-xl font-bold text-foreground">
          {formatCurrencyAmount(data.spent, currency)}
        </p>
        <VariationText value={data.spentVariation} goodWhenUp={false} />
        <Sparkline values={expensesSeries} color="#f97316" className="mt-2 h-6 w-full" />
      </div>

      <div className="rounded-2xl border border-token bg-background/75 p-4">
        <p className="text-xs text-muted-foreground">Ganancia neta</p>
        {data.canCalculateNet ? (
          <p className="mt-1 text-xl font-bold text-accent-token">
            {formatCurrencyAmount(data.net, currency)}
          </p>
        ) : (
          <Link href="/gastos" className="mt-1 inline-block text-sm font-medium text-accent-token">
            Registrá gastos para verla →
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-token bg-background/75 p-4">
        <p className="text-xs text-muted-foreground">Para seguir</p>
        <p className="mt-1 text-3xl font-bold leading-none text-foreground">
          {data.pendingCount}
        </p>
        <p className="mt-1 text-xs font-medium text-orange-600 dark:text-orange-300">
          {data.pendingCount === 1 ? "cotización pendiente" : "cotizaciones pendientes"}
        </p>
      </div>
    </div>
  );
}
