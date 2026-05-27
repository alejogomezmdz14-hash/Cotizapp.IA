import { formatCurrencyAmount } from "@/lib/formatting";
import type { DashboardStats } from "@/types";

export type QuotationMetricCardId =
  | "totalQuotedThisMonth"
  | "sentQuotations"
  | "acceptedQuotations"
  | "pendingQuotations"
  | "expensesThisMonth"
  | "netProfitThisMonth"
  | "netProfitPlaceholder";

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
  const acceptedQuotedThisMonth = stats.acceptedQuotedThisMonth;
  const hasExpenses = stats.expensesThisMonth > 0;

  const quotationMetricCards: DashboardQuotationMetricCard[] = [
    {
      id: "totalQuotedThisMonth",
      title: "Cotizado este mes",
      value: formatCurrencyAmount(acceptedQuotedThisMonth, currency),
      description: "Suma de cotizaciones aceptadas del mes actual.",
      href: "/cotizaciones",
    },
    {
      id: "sentQuotations",
      title: "Enviadas",
      value: formatDashboardCount(stats.quotationMetrics.sentQuotations),
      description: "Presupuestos que ya compartiste con tus clientes.",
      href: "/cotizaciones",
    },
    {
      id: "acceptedQuotations",
      title: "Aceptadas",
      value: formatDashboardCount(stats.quotationMetrics.acceptedQuotations),
      description: "Cotizaciones aprobadas listas para avanzar.",
      href: "/cotizaciones",
    },
    {
      id: "pendingQuotations",
      title: "Pendientes",
      value: formatDashboardCount(stats.quotationMetrics.pendingQuotations),
      description: "Oportunidades que siguen en seguimiento.",
      href: "/cotizaciones",
    },
    {
      id: "expensesThisMonth",
      title: "Gastos este mes",
      value: formatCurrencyAmount(stats.expensesThisMonth, currency),
      description: "Total registrado en gastos del mes actual.",
      href: "/gastos",
    },
  ];

  if (hasExpenses) {
    quotationMetricCards.push({
      id: "netProfitThisMonth",
      title: "Ganancia neta",
      value: formatCurrencyAmount(stats.netProfitThisMonth, currency),
      description: "Total aceptado del mes menos gastos registrados.",
      href: "/gastos",
    });
  } else {
    quotationMetricCards.push({
      id: "netProfitPlaceholder",
      title: "Ganancia neta",
      value: "—",
      description: "Registrá gastos para ver tu margen.",
      href: "/gastos",
    });
  }

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
