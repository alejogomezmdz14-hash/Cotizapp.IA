"use client";

import Link from "next/link";
import { BadgeCheck, Clock3, Receipt, Send, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardQuotationMetricCard } from "@/lib/dashboard-page";
import { cn } from "@/lib/utils";

type DashboardMetricCardsProps = {
  cards: DashboardQuotationMetricCard[];
  netProfitThisMonth: number;
};

const iconMap = {
  totalQuotedThisMonth: TrendingUp,
  sentQuotations: Send,
  acceptedQuotations: BadgeCheck,
  pendingQuotations: Clock3,
  expensesThisMonth: Receipt,
  netProfitThisMonth: Wallet,
  netProfitPlaceholder: Wallet,
} as const;

export function DashboardMetricCards({
  cards,
  netProfitThisMonth,
}: DashboardMetricCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card, index) => {
        const Icon = iconMap[card.id];
        const isExpenseCard = card.id === "expensesThisMonth";
        const isNetProfitCard = card.id === "netProfitThisMonth";
        const isNetProfitPlaceholder = card.id === "netProfitPlaceholder";
        const isHighlight = index === 0;

        return (
          <Link key={card.id} href={card.href} className="block">
            <Card
              className={cn(
                "!rounded-md !border-token !bg-background/75 !shadow-none transition hover:border-[rgb(var(--accent-rgb)/0.35)]",
                isHighlight &&
                  "!border-[rgb(var(--accent-rgb)/0.3)] !bg-[rgb(var(--accent-rgb)/0.08)]",
                isExpenseCard && "!border-orange-500/30 !bg-orange-500/8",
                isNetProfitCard &&
                  (netProfitThisMonth >= 0
                    ? "!border-emerald-500/30 !bg-emerald-500/8"
                    : "!border-destructive/30 !bg-destructive/8"),
                isNetProfitPlaceholder && "!border-dashed !border-token",
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
                    isNetProfitCard &&
                      (netProfitThisMonth >= 0
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                        : "border-destructive/40 bg-destructive/15 text-destructive"),
                    !isHighlight &&
                      !isExpenseCard &&
                      !isNetProfitCard &&
                      "border-token bg-background/80 text-foreground",
                  )}
                >
                  {isNetProfitCard && netProfitThisMonth < 0 ? (
                    <TrendingDown className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <CardDescription>{card.title}</CardDescription>
                  <CardTitle className={isHighlight ? "text-3xl lg:text-4xl" : "text-4xl"}>
                    {card.value}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
