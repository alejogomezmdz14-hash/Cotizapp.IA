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
  collectedThisMonth: 950,
  monthlyComparison: [],
};

test("buildDashboardPageCards exposes four monthly KPIs without duplicate accepted totals", () => {
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

  assert.equal(sections.quotationMetricCards.length, 4);
  assert.deepEqual(
    sections.quotationMetricCards.map((card) => card.title),
    [
      "Cobrado este mes",
      "Cotizaciones enviadas",
      "Pendientes de respuesta",
      "Gastos del mes",
    ],
  );
  assert.equal(
    sections.quotationMetricCards[0]?.value,
    formatCurrencyAmount(950, "ARS"),
  );
  assert.equal(sections.quotationMetricCards[0]?.href, "/cotizaciones");
  assert.match(sections.quotationMetricCards[3]?.value ?? "", /ARS/);

  assert.equal(sections.summaryCards.length, 3);
  assert.deepEqual(
    sections.summaryCards.map((card) => card.title),
    ["Cotizaciones totales", "Clientes", "Catalogo"],
  );
});

test("buildDashboardPageCards formats multi-currency expenses", () => {
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

  assert.match(sections.quotationMetricCards[3]?.value ?? "", /ARS/);
  assert.match(sections.quotationMetricCards[3]?.value ?? "", /USD/);
});
