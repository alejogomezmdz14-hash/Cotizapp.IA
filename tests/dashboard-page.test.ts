import assert from "node:assert/strict";
import test from "node:test";

import { formatCurrencyAmount } from "../lib/formatting";
import { buildDashboardPageCards } from "../lib/dashboard-page";

const baseStats = {
  quotations: 18,
  clients: 7,
  catalogItems: 42,
  quotationMetrics: {
    totalQuotedThisMonth: 2050.5,
    sentQuotations: 9,
    acceptedQuotations: 4,
    pendingQuotations: 6,
  },
  acceptedQuotedThisMonth: 1800,
  collectedThisMonth: 0,
  monthlyComparison: [],
};

test("buildDashboardPageCards prioritizes quotation KPIs and formats the monthly total as currency", () => {
  const sections = buildDashboardPageCards(
    {
      ...baseStats,
      expensesThisMonth: 320,
      expensesByCurrency: [{ currency: "ARS", total: 320 }],
      netProfitThisMonth: 1480,
      canCalculateNetProfit: true,
    },
    "ARS",
  );

  assert.equal(sections.quotationMetricCards.length, 6);
  assert.deepEqual(
    sections.quotationMetricCards.map((card) => card.title),
    [
      "Aceptado este mes",
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
  assert.match(sections.quotationMetricCards[4]?.value ?? "", /ARS/);

  const noExpenseSections = buildDashboardPageCards(
    {
      ...baseStats,
      expensesThisMonth: 0,
      expensesByCurrency: [],
      netProfitThisMonth: 1800,
      canCalculateNetProfit: false,
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

test("buildDashboardPageCards hides net profit when expenses use multiple currencies", () => {
  const sections = buildDashboardPageCards(
    {
      ...baseStats,
      expensesThisMonth: 370,
      expensesByCurrency: [
        { currency: "ARS", total: 320 },
        { currency: "USD", total: 50 },
      ],
      netProfitThisMonth: 0,
      canCalculateNetProfit: false,
    },
    "ARS",
  );

  assert.equal(sections.quotationMetricCards[5]?.id, "netProfitPlaceholder");
  assert.match(sections.quotationMetricCards[4]?.value ?? "", /ARS/);
  assert.match(sections.quotationMetricCards[4]?.value ?? "", /USD/);
});
