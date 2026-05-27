export const EXPENSE_CATEGORIES = [
  "Materiales",
  "Herramientas",
  "Transporte",
  "Combustible",
  "Comida",
  "Servicios",
  "Marketing",
  "Alquiler",
  "Impuestos",
  "Otro",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const CATEGORY_BADGE_CLASSES: Record<ExpenseCategory, string> = {
  Materiales: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  Herramientas: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Transporte: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Combustible: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Comida: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  Servicios: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  Marketing: "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  Alquiler: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  Impuestos: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Otro: "border-token bg-background/70 text-muted-foreground",
};

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function getExpenseCategoryBadgeClassName(category: string) {
  if (isExpenseCategory(category)) {
    return CATEGORY_BADGE_CLASSES[category];
  }

  return CATEGORY_BADGE_CLASSES.Otro;
}
