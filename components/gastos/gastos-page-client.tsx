"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { ExpenseFormSheet } from "@/components/gastos/expense-form-sheet";
import { ExpenseKpis } from "@/components/gastos/expense-kpis";
import { ExpenseList } from "@/components/gastos/expense-list";
import { Button } from "@/components/ui/button";
import type { Expense, ExpenseMonthStats } from "@/types";

type GastosPageClientProps = {
  expenses: Expense[];
  stats: ExpenseMonthStats;
  currency: string | null;
};

export function GastosPageClient({
  expenses,
  stats,
  currency,
}: GastosPageClientProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-6 pb-20">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Gastos
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Registro de gastos
          </h2>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo gasto
        </Button>
      </section>

      <ExpenseKpis stats={stats} currency={currency} />

      <ExpenseList expenses={expenses} currency={currency} />

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
