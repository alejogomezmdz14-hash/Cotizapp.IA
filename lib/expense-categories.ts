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
  Materiales: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Herramientas:
    "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  Transporte: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  Combustible:
    "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
  Comida: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300",
  Servicios:
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Marketing: "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  Alquiler: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  Impuestos: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
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
