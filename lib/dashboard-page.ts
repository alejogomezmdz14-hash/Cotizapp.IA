import {
  formatCurrencyAmount,
  formatExpenseTotalsByCurrency,
} from "@/lib/formatting";
import type { DashboardStats } from "@/types";

export type QuotationMetricCardId =
  | "collectedThisMonth"
  | "sentQuotations"
  | "pendingQuotations"
  | "expensesThisMonth";

export type DashboardSummaryCardId =
  | "quotations"
  | "clients"
  | "catalogItems";

type DashboardBaseCard = {
  title: string;
  value: string;
  description: string;
  href: string;
};

export type DashboardQuotationMetricCard = DashboardBaseCard & {
  id: QuotationMetricCardId;
};

export type DashboardSummaryCard = DashboardBaseCard & {
  id: DashboardSummaryCardId;
};

type DashboardPageCards = {
  quotationMetricCards: DashboardQuotationMetricCard[];
  summaryCards: DashboardSummaryCard[];
};

const countFormatter = new Intl.NumberFormat("es-AR");

function formatDashboardCount(value: number) {
  return countFormatter.format(value);
}

export function buildDashboardPageCards(
  stats: DashboardStats,
  currency: string | null,
): DashboardPageCards {
  const hasExpenses = stats.expensesByCurrency.length > 0;
  const expensesLabel = hasExpenses
    ? formatExpenseTotalsByCurrency(stats.expensesByCurrency)
    : formatCurrencyAmount(0, currency);

  const quotationMetricCards: DashboardQuotationMetricCard[] = [
    {
      id: "collectedThisMonth",
      title: "Cobrado este mes",
      value: formatCurrencyAmount(stats.collectedThisMonth, currency),
      description: "",
      href: "/cotizaciones",
    },
    {
      id: "sentQuotations",
      title: "Cotizaciones enviadas",
      value: formatDashboardCount(stats.quotationMetrics.sentQuotations),
      description: "",
      href: "/cotizaciones",
    },
    {
      id: "pendingQuotations",
      title: "Pendientes de respuesta",
      value: formatDashboardCount(stats.quotationMetrics.pendingQuotations),
      description: "",
      href: "/cotizaciones",
    },
    {
      id: "expensesThisMonth",
      title: "Gastos del mes",
      value: expensesLabel,
      description: "",
      href: "/gastos",
    },
  ];

  return {
    quotationMetricCards,
    summaryCards: [
      {
        id: "quotations",
        title: "Cotizaciones totales",
        value: formatDashboardCount(stats.quotations),
        description: "Historial completo de documentos generados.",
        href: "/cotizaciones",
      },
      {
        id: "clients",
        title: "Clientes",
        value: formatDashboardCount(stats.clients),
        description: "Contactos listos para continuar conversaciones.",
        href: "/clientes",
      },
      {
        id: "catalogItems",
        title: "Catalogo",
        value: formatDashboardCount(stats.catalogItems),
        description: "Productos y servicios disponibles para cotizar.",
        href: "/catalogo",
      },
    ],
  };
}
