import { GastosPageClient } from "@/components/gastos/gastos-page-client";
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import { getExpenseMonthStats, getExpensesByMonth } from "@/lib/expenses";
import { getProfile, requireUser } from "@/lib/profile";

export default async function GastosPage() {
  const user = await requireUser();
  const [profile, monthGroups, stats] = await Promise.all([
    getProfile(user.id),
    getExpensesByMonth(user.id),
    getExpenseMonthStats(user.id),
  ]);

  const defaultCurrency = normalizeExpenseCurrency(profile?.currency ?? "ARS");

  return (
    <GastosPageClient
      monthGroups={monthGroups}
      stats={stats}
      defaultCurrency={defaultCurrency}
    />
  );
}
