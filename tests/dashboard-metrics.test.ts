import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as dashboardModule from "../lib/dashboard";

type DashboardQuotationMetricsRpcRow = {
  quotations: number | string | null;
  sent_quotations: number | string | null;
  accepted_quotations: number | string | null;
  pending_quotations: number | string | null;
  total_quoted_this_month: number | string | null;
};

function getRpcRowParser() {
  const parseDashboardQuotationMetricsRow = Reflect.get(
    dashboardModule,
    "parseDashboardQuotationMetricsRow",
  ) as
    | ((row: DashboardQuotationMetricsRpcRow | null | undefined) => {
        quotations: number;
        quotationMetrics: {
          totalQuotedThisMonth: number;
          sentQuotations: number;
          acceptedQuotations: number;
          pendingQuotations: number;
        };
      })
    | undefined;

  assert.equal(
    typeof parseDashboardQuotationMetricsRow,
    "function",
    "Expected lib/dashboard to export parseDashboardQuotationMetricsRow",
  );

  return parseDashboardQuotationMetricsRow as (
    row: DashboardQuotationMetricsRpcRow | null | undefined,
  ) => {
    quotations: number;
    quotationMetrics: {
      totalQuotedThisMonth: number;
      sentQuotations: number;
      acceptedQuotations: number;
      pendingQuotations: number;
    };
  };
}

test("parseDashboardQuotationMetricsRow safely converts rpc output into dashboard stats", () => {
  const parseDashboardQuotationMetricsRow = getRpcRowParser();

  assert.deepEqual(
    parseDashboardQuotationMetricsRow({
      quotations: "18",
      sent_quotations: "9",
      accepted_quotations: "4",
      pending_quotations: "6",
      total_quoted_this_month: "2050.50",
    }),
    {
      quotations: 18,
      quotationMetrics: {
        totalQuotedThisMonth: 2050.5,
        sentQuotations: 9,
        acceptedQuotations: 4,
        pendingQuotations: 6,
      },
    },
  );
});

test("parseDashboardQuotationMetricsRow falls back to zero for invalid rpc values", () => {
  const parseDashboardQuotationMetricsRow = getRpcRowParser();

  assert.deepEqual(
    parseDashboardQuotationMetricsRow({
      quotations: null,
      sent_quotations: "invalid",
      accepted_quotations: undefined as never,
      pending_quotations: null,
      total_quoted_this_month: "NaN",
    }),
    {
      quotations: 0,
      quotationMetrics: {
        totalQuotedThisMonth: 0,
        sentQuotations: 0,
        acceptedQuotations: 0,
        pendingQuotations: 0,
      },
    },
  );
});

test("dashboard metrics migration derives tenant scope from auth.uid and preserves legacy aliases", async () => {
  const source = await readFile(
    new URL(
      "../supabase/migrations/20260526_add_dashboard_quotation_metrics_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    source,
    /CREATE OR REPLACE FUNCTION public\.get_dashboard_quotation_metrics\(\)/i,
  );
  assert.match(source, /auth\.uid\(\)/i);
  assert.match(source, /'accepted'\s*,\s*'approved'/i);
  assert.match(source, /'pending'\s*,\s*'sent'/i);
});
