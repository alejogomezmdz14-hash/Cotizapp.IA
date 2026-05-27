"use client";

import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";

type ExpensePeriodSelectorProps = {
  monthGroups: Array<{ monthKey: string; monthLabel: string }>;
  selectedMonthKey: string;
};

export function ExpensePeriodSelector({
  monthGroups,
  selectedMonthKey,
}: ExpensePeriodSelectorProps) {
  const router = useRouter();

  return (
    <div className="space-y-2">
      <Label htmlFor="expense-period">Período</Label>
      <select
        id="expense-period"
        value={selectedMonthKey}
        className="w-full rounded-md border border-token bg-background px-3 py-2 text-sm text-foreground sm:max-w-xs"
        onChange={(event) => {
          const nextMonth = event.target.value;
          router.replace(nextMonth ? `/gastos?month=${nextMonth}` : "/gastos");
        }}
      >
        {monthGroups.map((group) => (
          <option key={group.monthKey} value={group.monthKey}>
            {group.monthLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
