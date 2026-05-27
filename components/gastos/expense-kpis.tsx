import { Hash, Receipt, Tags } from "lucide-react";

import { formatCurrencyAmount } from "@/lib/formatting";
import type { ExpenseMonthStats } from "@/types";

type ExpenseKpisProps = {
  stats: ExpenseMonthStats;
  currency: string | null;
};

export function ExpenseKpis({ stats, currency }: ExpenseKpisProps) {
  const cards = [
    {
      title: "Total este mes",
      value: formatCurrencyAmount(stats.totalThisMonth, currency),
      description: "Suma de gastos registrados en el mes.",
      icon: Receipt,
      accent: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300",
    },
    {
      title: "Cantidad de gastos",
      value: String(stats.expenseCount),
      description: "Movimientos cargados en el mes actual.",
      icon: Hash,
      accent: "border-token bg-background/80 text-foreground",
    },
    {
      title: "Categoría más usada",
      value: stats.topCategory ?? "Sin datos",
      description: "La categoría con más registros este mes.",
      icon: Tags,
      accent: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(({ title, value, description, icon: Icon, accent }) => (
        <div
          key={title}
          className="rounded-[1.75rem] border border-token bg-background/75 p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className={`rounded-2xl border p-3 ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
