import { formatCurrencyAmount } from "@/lib/formatting";
import type { DashboardStats } from "@/types";

export type QuotationMetricCardId =
  | "totalQuotedThisMonth"
  | "sentQuotations"
  | "acceptedQuotations"
  | "pendingQuotations"
  | "expensesThisMonth"
  | "netProfitThisMonth";

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
  return {
    quotationMetricCards: [
      {
        id: "totalQuotedThisMonth",
        title: "Cotizado este mes",
        value: formatCurrencyAmount(
          stats.quotationMetrics.totalQuotedThisMonth,
          currency,
        ),
        description: "Monto acumulado de cotizaciones creadas este mes.",
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
      {
        id: "netProfitThisMonth",
        title: "Ganancia neta",
        value: formatCurrencyAmount(stats.netProfitThisMonth, currency),
        description: "Cotizado aceptado menos gastos del mes.",
        href: "/gastos",
      },
    ],
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
