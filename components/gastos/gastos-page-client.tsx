"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { ExpenseFormSheet } from "@/components/gastos/expense-form-sheet";
import { ExpenseKpis } from "@/components/gastos/expense-kpis";
import { ExpenseList } from "@/components/gastos/expense-list";
import { Button } from "@/components/ui/button";
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import type { ExpenseMonthGroup, ExpenseMonthStats } from "@/types";

type GastosPageClientProps = {
  monthGroups: ExpenseMonthGroup[];
  stats: ExpenseMonthStats;
  defaultCurrency: string;
};

export function GastosPageClient({
  monthGroups,
  stats,
  defaultCurrency,
}: GastosPageClientProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const currency = normalizeExpenseCurrency(defaultCurrency);

  return (
    <div className="space-y-6 pb-20">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <span className="inline-flex w-fit rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700 dark:text-orange-300">
            Gastos
          </span>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Registro de gastos
          </h2>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo gasto
        </Button>
      </section>

      <ExpenseKpis stats={stats} />

      <ExpenseList monthGroups={monthGroups} defaultCurrency={currency} />

      <ExpenseFormSheet
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultCurrency={currency}
        onSaved={() => {
          setIsCreateOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
