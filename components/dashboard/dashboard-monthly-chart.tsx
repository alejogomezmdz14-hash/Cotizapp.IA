"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import type { DashboardMonthlyPoint } from "@/types";

type DashboardMonthlyChartProps = {
  data: DashboardMonthlyPoint[];
  currency: string | null;
};

function formatAxisValue(value: number, currency: string | null) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }

  return new Intl.NumberFormat("es-AR", {
    style: currency ? "currency" : "decimal",
    currency: currency ?? undefined,
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardMonthlyChart({
  data,
  currency,
}: DashboardMonthlyChartProps) {
  const hasData = data.some((point) => point.quoted > 0 || point.expenses > 0);

  if (!hasData) {
    return (
      <div className="flex h-72 w-full flex-col items-center justify-center gap-4 rounded-md border border-dashed border-token/80 bg-background/60 px-6 text-center">
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Acá vas a ver cuánto cotizaste y cuánto gastaste cada mes.
        </p>
        <Button asChild className="min-h-12">
          <Link href="/cotizaciones/nueva">Crear cotización</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(value) => formatAxisValue(Number(value), currency)} />
          <Tooltip
            formatter={(value, name) => {
              const numericValue = Array.isArray(value)
                ? Number(value[0] ?? 0)
                : Number(value ?? 0);

              return [
                new Intl.NumberFormat("es-AR", {
                  style: currency ? "currency" : "decimal",
                  currency: currency ?? undefined,
                  maximumFractionDigits: 0,
                }).format(numericValue),
                String(name) === "quoted" ? "Cotizaciones" : "Gastos",
              ];
            }}
          />
          <Legend
            formatter={(value) =>
              value === "quoted" ? "Cotizaciones" : "Gastos"
            }
          />
          <Bar dataKey="quoted" name="quoted" fill="rgb(var(--accent-rgb))" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expenses" name="expenses" fill="#f97316" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
