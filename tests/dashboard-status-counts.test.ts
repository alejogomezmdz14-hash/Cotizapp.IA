// tests/dashboard-status-counts.test.ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  bucketQuotationStatusCounts,
  emptyQuotationStatusCounts,
} from "../lib/dashboard-status-counts";

test("bucketQuotationStatusCounts agrupa por estado y aplica alias", () => {
  const counts = bucketQuotationStatusCounts([
    "accepted",
    "approved", // alias de accepted
    "sent", // alias de pending
    "pending",
    "rejected",
    "expired",
    "draft",
    null,
    "loquesea", // estado inválido => se ignora
  ]);

  assert.deepEqual(counts, {
    accepted: 2,
    pending: 2,
    rejected: 1,
    expired: 1,
    draft: 1,
    total: 7,
  });
});

test("emptyQuotationStatusCounts arranca todo en 0", () => {
  assert.deepEqual(emptyQuotationStatusCounts(), {
    accepted: 0,
    pending: 0,
    rejected: 0,
    expired: 0,
    draft: 0,
    total: 0,
  });
});
