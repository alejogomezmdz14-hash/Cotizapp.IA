import assert from "node:assert/strict";
import test from "node:test";

import { formatCurrencyAmount } from "../lib/formatting";
import { buildDashboardPageCards } from "../lib/dashboard-page";

test("buildDashboardPageCards prioritizes quotation KPIs and formats the monthly total as currency", () => {
  const sections = buildDashboardPageCards(
    {
      quotations: 18,
      clients: 7,
      catalogItems: 42,
      quotationMetrics: {
        totalQuotedThisMonth: 2050.5,
        sentQuotations: 9,
        acceptedQuotations: 4,
        pendingQuotations: 6,
      },
      expensesThisMonth: 320,
      acceptedQuotedThisMonth: 1800,
      netProfitThisMonth: 1480,
    },
    "ARS",
  );

  assert.equal(sections.quotationMetricCards.length, 6);
  assert.deepEqual(
    sections.quotationMetricCards.map((card) => card.title),
    [
      "Cotizado este mes",
      "Enviadas",
      "Aceptadas",
      "Pendientes",
      "Gastos este mes",
      "Ganancia neta",
    ],
  );
  assert.equal(
    sections.quotationMetricCards[0]?.value,
    formatCurrencyAmount(1800, "ARS"),
  );
  assert.equal(sections.quotationMetricCards[0]?.href, "/cotizaciones");
  const noExpenseSections = buildDashboardPageCards(
    {
      quotations: 18,
      clients: 7,
      catalogItems: 42,
      quotationMetrics: {
        totalQuotedThisMonth: 2050.5,
        sentQuotations: 9,
        acceptedQuotations: 4,
        pendingQuotations: 6,
      },
      expensesThisMonth: 0,
      acceptedQuotedThisMonth: 1800,
      netProfitThisMonth: 1800,
    },
    "ARS",
  );

  assert.equal(noExpenseSections.quotationMetricCards.length, 6);
  assert.equal(
    noExpenseSections.quotationMetricCards[5]?.id,
    "netProfitPlaceholder",
  );

  assert.equal(sections.summaryCards.length, 3);
  assert.deepEqual(
    sections.summaryCards.map((card) => card.title),
    ["Cotizaciones totales", "Clientes", "Catalogo"],
  );
});
