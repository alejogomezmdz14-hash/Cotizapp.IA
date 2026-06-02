"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { deleteExpense } from "@/app/actions/expenses";
import { ExpenseFormSheet } from "@/components/gastos/expense-form-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { getExpenseCategoryBadgeClassName } from "@/lib/expense-categories";
import { formatDateOnly, formatExpenseAmount } from "@/lib/formatting";
import type { Expense, ExpenseMonthGroup } from "@/types";

type ExpenseListProps = {
  monthGroups: ExpenseMonthGroup[];
  defaultCurrency: string;
};

function getCurrentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function ExpenseList({ monthGroups, defaultCurrency }: ExpenseListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentMonthGroup = useMemo(() => {
    const currentMonthKey = getCurrentMonthKey();
    return monthGroups.find((group) => group.monthKey === currentMonthKey);
  }, [monthGroups]);

  const hasAnyExpenses = monthGroups.some((group) => group.expenses.length > 0);

  function handleDelete() {
    if (!deletingExpense) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await deleteExpense(deletingExpense.id);
        setDeletingExpense(null);
        router.refresh();
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "No se pudo eliminar el gasto.",
        );
      }
    });
  }

  if (!hasAnyExpenses) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-12 text-center">
        <p className="text-lg font-semibold text-foreground">
          Todavía no registraste gastos este mes.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Empezá agregando uno.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {monthGroups.map((group) => (
          <section key={group.monthKey} className="space-y-3">
            <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {group.monthLabel}
            </h3>

            <div className="space-y-3">
              {group.expenses.map((expense) => (
                <article
                  key={expense.id}
                  className="flex flex-col gap-4 rounded-[1.75rem] border border-token bg-background/75 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {formatDateOnly(expense.date)}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getExpenseCategoryBadgeClassName(
                          expense.category,
                        )}`}
                      >
                        {expense.category}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-foreground">
                      {expense.description}
                    </p>
                    {expense.notes ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {expense.notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <p className="text-lg font-semibold text-foreground">
                      {formatExpenseAmount(
                        expense.amount,
                        expense.currency || defaultCurrency,
                      )}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-background/75"
                        onClick={() => setEditingExpense(expense)}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 bg-background/75 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeletingExpense(expense)}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {!currentMonthGroup?.expenses.length && hasAnyExpenses ? (
        <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-8 text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            No hay gastos registrados en este mes.
          </p>
        </div>
      ) : null}

      <ExpenseFormSheet
        open={Boolean(editingExpense)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingExpense(null);
          }
        }}
        expense={editingExpense}
        defaultCurrency={defaultCurrency}
        onSaved={() => {
          setEditingExpense(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingExpense)}
        title="Eliminar gasto"
        description={
          deletingExpense
            ? `¿Querés eliminar "${deletingExpense.description}"? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        isLoading={isPending}
        onCancel={() => {
          setDeletingExpense(null);
          setError(null);
        }}
        onConfirm={handleDelete}
      />

      {error ? (
        <p className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </>
  );
}
