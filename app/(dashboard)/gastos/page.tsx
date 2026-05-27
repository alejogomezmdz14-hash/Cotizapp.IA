import { GastosPageClient } from "@/components/gastos/gastos-page-client";
import { getExpenseMonthStats, getExpenses } from "@/lib/expenses";
import { getProfile, requireUser } from "@/lib/profile";

export default async function GastosPage() {
  const user = await requireUser();
  const [profile, expenses, stats] = await Promise.all([
    getProfile(user.id),
    getExpenses(user.id),
    getExpenseMonthStats(user.id),
  ]);

  return (
    <GastosPageClient
      expenses={expenses}
      stats={stats}
      currency={profile?.currency ?? null}
    />
  );
}
