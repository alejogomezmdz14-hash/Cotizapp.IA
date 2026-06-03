import { Hash, Receipt, Tags } from "lucide-react";

import {
  formatCurrencyAmount,
  formatExpenseAmount,
  formatExpenseTotalsByCurrency,
} from "@/lib/formatting";
import type { ExpenseMonthStats } from "@/types";

type ExpenseKpisProps = {
  stats: ExpenseMonthStats;
};

export function ExpenseKpis({ stats }: ExpenseKpisProps) {
  const totalLabel =
    stats.totalsByCurrency.length > 0
      ? formatExpenseTotalsByCurrency(stats.totalsByCurrency)
      : formatCurrencyAmount(0, "ARS");

  const topCategoryValue =
    stats.topCategory && stats.topCategoryAmount > 0
      ? `${stats.topCategory} · ${formatExpenseAmount(
          stats.topCategoryAmount,
          stats.totalsByCurrency[0]?.currency ?? "ARS",
        )}`
      : stats.topCategory ?? "Sin datos";

  const cards = [
    {
      title: "Total este mes",
      value: totalLabel,
      icon: Receipt,
      accent: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300",
    },
    {
      title: "Cantidad de gastos",
      value: String(stats.expenseCount),
      icon: Hash,
      accent: "border-token bg-background/80 text-foreground",
    },
    {
      title: "Donde más gastaste",
      value: topCategoryValue,
      icon: Tags,
      accent: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(({ title, value, icon: Icon, accent }) => (
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
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
