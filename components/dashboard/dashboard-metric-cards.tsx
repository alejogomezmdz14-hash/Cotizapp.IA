"use client";

import Link from "next/link";
import { Clock3, Receipt, Send, Wallet } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardQuotationMetricCard } from "@/lib/dashboard-page";
import { cn } from "@/lib/utils";

type DashboardMetricCardsProps = {
  cards: DashboardQuotationMetricCard[];
};

const iconMap = {
  collectedThisMonth: Wallet,
  sentQuotations: Send,
  pendingQuotations: Clock3,
  expensesThisMonth: Receipt,
} as const;

export function DashboardMetricCards({ cards }: DashboardMetricCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = iconMap[card.id];
        const isHighlight = index === 0;
        const isExpenseCard = card.id === "expensesThisMonth";

        return (
          <Link key={card.id} href={card.href} className="block">
            <Card
              className={cn(
                "!rounded-md !border-token !bg-background/75 !shadow-none transition hover:border-[rgb(var(--accent-rgb)/0.35)]",
                isHighlight &&
                  "!border-[rgb(var(--accent-rgb)/0.3)] !bg-[rgb(var(--accent-rgb)/0.08)]",
                isExpenseCard && "!border-orange-500/30 !bg-orange-500/8",
              )}
            >
              <CardHeader className="space-y-4">
                <div
                  className={cn(
                    "w-fit rounded-2xl border p-3",
                    isHighlight &&
                      "border-[rgb(var(--accent-rgb)/0.24)] bg-[rgb(var(--accent-rgb)/0.12)] text-accent-token",
                    isExpenseCard &&
                      "border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-300",
                    !isHighlight &&
                      !isExpenseCard &&
                      "border-token bg-background/80 text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <CardDescription>{card.title}</CardDescription>
                  <CardTitle className={isHighlight ? "text-3xl lg:text-4xl" : "text-4xl"}>
                    {card.value}
                  </CardTitle>
                </div>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
