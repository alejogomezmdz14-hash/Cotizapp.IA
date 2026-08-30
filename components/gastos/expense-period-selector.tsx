"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

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
      <Label htmlFor="expense-period">Ver mes</Label>
      <NativeSelect
        id="expense-period"
        value={selectedMonthKey}
        className="sm:max-w-xs"
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
      </NativeSelect>
    </div>
  );
}
