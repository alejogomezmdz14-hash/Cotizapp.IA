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
    },
    "ARS",
  );

  assert.equal(sections.quotationMetricCards.length, 4);
  assert.deepEqual(
    sections.quotationMetricCards.map((card) => card.title),
    [
      "Cotizado este mes",
      "Enviadas",
      "Aceptadas",
      "Pendientes",
    ],
  );
  assert.equal(
    sections.quotationMetricCards[0]?.value,
    formatCurrencyAmount(2050.5, "ARS"),
  );
  assert.equal(sections.quotationMetricCards[0]?.href, "/cotizaciones");
  assert.equal(sections.summaryCards.length, 3);
  assert.deepEqual(
    sections.summaryCards.map((card) => card.title),
    ["Cotizaciones totales", "Clientes", "Catalogo"],
  );
});
