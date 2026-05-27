import { GastosPageClient } from "@/components/gastos/gastos-page-client";
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import { getExpenseStatsForMonth, getExpensesByMonth } from "@/lib/expenses";
import { getProfile, requireUser } from "@/lib/profile";

type GastosPageProps = {
  searchParams?: {
    month?: string;
  };
};

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function GastosPage({ searchParams }: GastosPageProps) {
  const user = await requireUser();
  const monthGroups = await getExpensesByMonth(user.id);
  const availableMonthKeys = monthGroups.map((group) => group.monthKey);
  const requestedMonth =
    typeof searchParams?.month === "string" ? searchParams.month : "";
  const selectedMonthKey = availableMonthKeys.includes(requestedMonth)
    ? requestedMonth
    : availableMonthKeys[0] ?? getCurrentMonthKey();

  const [profile, stats] = await Promise.all([
    getProfile(user.id),
    getExpenseStatsForMonth(user.id, selectedMonthKey),
  ]);

  const defaultCurrency = normalizeExpenseCurrency(profile?.currency ?? "ARS");

  return (
    <GastosPageClient
      monthGroups={monthGroups}
      selectedMonthKey={selectedMonthKey}
      stats={stats}
      defaultCurrency={defaultCurrency}
    />
  );
}
