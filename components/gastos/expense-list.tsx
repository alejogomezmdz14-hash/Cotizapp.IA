"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { deleteExpenseAction } from "@/app/actions/expenses";
import { ExpenseFormSheet } from "@/components/gastos/expense-form-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { getExpenseCategoryBadgeClassName } from "@/lib/expense-categories";
import { formatCurrencyAmount, formatDateOnly } from "@/lib/formatting";
import type { Expense } from "@/types";

type ExpenseListProps = {
  expenses: Expense[];
  currency: string | null;
};

export function ExpenseList({ expenses, currency }: ExpenseListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!deletingExpense) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await deleteExpenseAction(deletingExpense.id);
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

  if (expenses.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-12 text-center">
        <p className="text-lg font-semibold text-foreground">
          Todavía no registraste gastos
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Cargá tu primer gasto para ver el resumen del mes y controlar tu
          ganancia neta.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {expenses.map((expense) => (
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
            </div>

            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <p className="text-lg font-semibold text-foreground">
                {formatCurrencyAmount(expense.amount, expense.currency || currency)}
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

      <ExpenseFormSheet
        open={Boolean(editingExpense)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingExpense(null);
          }
        }}
        expense={editingExpense}
        defaultCurrency={currency}
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
