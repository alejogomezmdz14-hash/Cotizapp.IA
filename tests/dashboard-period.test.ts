import assert from "node:assert/strict";
import test from "node:test";

import {
  getPeriodBoundaries,
  summarizeDashboardPeriod,
} from "../lib/dashboard-period";

test("getPeriodBoundaries('month') cubre del día 1 al último del mes", () => {
  const { start, end, startDateOnly, endDateOnly } = getPeriodBoundaries(
    "month",
    new Date(2026, 5, 17), // 17 jun 2026, hora local
  );

  assert.equal(start.getDate(), 1);
  assert.equal(start.getMonth(), 5);
  assert.equal(start.getHours(), 0);
  assert.equal(end.getDate(), 30);
  assert.equal(end.getMonth(), 5);
  assert.equal(startDateOnly, "2026-06-01");
  assert.equal(endDateOnly, "2026-06-30");
});

test("getPeriodBoundaries('week') va de lunes a domingo y contiene el día actual", () => {
  const now = new Date(2026, 5, 17, 15, 0, 0); // miércoles 17 jun 2026
  const { start, end } = getPeriodBoundaries("week", now);

  assert.equal(start.getDay(), 1); // lunes
  assert.equal(end.getDay(), 0); // domingo
  assert.equal(start.getDate(), 15);
  assert.equal(end.getDate(), 21);
  assert.equal(start.getHours(), 0);
  assert.ok(start.getTime() <= now.getTime());
  assert.ok(now.getTime() <= end.getTime());
});

test("getPeriodBoundaries('week') con domingo arranca el lunes anterior", () => {
  const sunday = new Date(2026, 5, 21, 10, 0, 0); // domingo 21 jun 2026
  const { start, end } = getPeriodBoundaries("week", sunday);

  assert.equal(start.getDay(), 1);
  assert.equal(start.getDate(), 15);
  assert.equal(end.getDate(), 21);
});

test("summarizeDashboardPeriod calcula neto con una sola moneda que coincide con el perfil", () => {
  const summary = summarizeDashboardPeriod({
    acceptedTotal: 1000,
    expenses: [
      { amount: 200, currency: "ARS" },
      { amount: 100, currency: "ARS" },
    ],
    profileCurrency: "ARS",
  });

  assert.deepEqual(summary, {
    accepted: 1000,
    spent: 300,
    net: 700,
    canCalculateNet: true,
  });
});

test("summarizeDashboardPeriod no calcula neto con múltiples monedas", () => {
  const summary = summarizeDashboardPeriod({
    acceptedTotal: 1000,
    expenses: [
      { amount: 200, currency: "ARS" },
      { amount: 50, currency: "USD" },
    ],
    profileCurrency: "ARS",
  });

  assert.equal(summary.canCalculateNet, false);
  assert.equal(summary.net, 0);
  assert.equal(summary.accepted, 1000);
});

test("summarizeDashboardPeriod sin gastos deja neto en 0", () => {
  const summary = summarizeDashboardPeriod({
    acceptedTotal: 500,
    expenses: [],
    profileCurrency: "ARS",
  });

  assert.deepEqual(summary, {
    accepted: 500,
    spent: 0,
    net: 0,
    canCalculateNet: false,
  });
});

import { getPreviousPeriodNow } from "../lib/dashboard-period";

test("getPreviousPeriodNow('month') cae en el mes anterior", () => {
  const prev = getPreviousPeriodNow("month", new Date(2026, 5, 17)); // jun 2026
  assert.equal(prev.getMonth(), 4); // mayo
  assert.equal(prev.getFullYear(), 2026);
});

test("getPreviousPeriodNow('week') resta 7 días", () => {
  const prev = getPreviousPeriodNow("week", new Date(2026, 5, 17)); // 17 jun
  assert.equal(prev.getDate(), 10); // 10 jun
  assert.equal(prev.getMonth(), 5);
});
