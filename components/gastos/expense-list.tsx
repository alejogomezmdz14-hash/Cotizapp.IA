"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";

import { deleteExpense } from "@/app/actions/expenses";
import { ExpenseFormSheet } from "@/components/gastos/expense-form-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-12 w-12"
                          aria-label="Acciones del gasto"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditingExpense(expense)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeletingExpense(expense)}
                        >
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            ? `¿Seguro que querés eliminar "${deletingExpense.description}"? No se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, eliminar"
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
