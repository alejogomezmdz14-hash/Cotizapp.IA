import assert from "node:assert/strict";
import test from "node:test";

type HydratedInvoiceScanReview = {
  scanId: string;
  fileName: string;
  status: "uploaded" | "processing" | "failed" | "completed";
  failureMessage: string | null;
  result: {
    supplierName: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    currency: string | null;
    notes: string | null;
    warnings: string[];
    items: Array<{
      name: string;
      description: string | null;
      quantity: number;
      unit: string;
      unitPrice: number;
    }>;
  } | null;
};

type ReviewStateModule = {
  mergeHydratedInvoiceScanReview: (
    currentReview: HydratedInvoiceScanReview | null,
    nextReview: HydratedInvoiceScanReview | null,
  ) => HydratedInvoiceScanReview | null;
};

async function getReviewStateModule() {
  const reviewStateModule = await import("../lib/invoice-scan/review-state").catch(
    () => null,
  );
  assert.ok(
    reviewStateModule,
    "Expected ../lib/invoice-scan/review-state to exist.",
  );

  return reviewStateModule as ReviewStateModule;
}

function createReview(
  overrides: Partial<HydratedInvoiceScanReview> = {},
): HydratedInvoiceScanReview {
  return {
    scanId: "scan-1",
    fileName: "factura.png",
    status: "processing",
    failureMessage: null,
    result: null,
    ...overrides,
  };
}

test("mergeHydratedInvoiceScanReview adopts fresher persisted data for the same scan id", async () => {
  const { mergeHydratedInvoiceScanReview } = await getReviewStateModule();

  const currentReview = createReview({
    status: "processing",
  });
  const nextReview = createReview({
    status: "completed",
    result: {
      supplierName: "Proveedor Uno",
      invoiceNumber: "A-0001",
      invoiceDate: "2026-05-26",
      currency: "ARS",
      notes: null,
      warnings: [],
      items: [
        {
          name: "Cemento",
          description: null,
          quantity: 2,
          unit: "bolsa",
          unitPrice: 3500,
        },
      ],
    },
  });

  assert.deepEqual(
    mergeHydratedInvoiceScanReview(currentReview, nextReview),
    nextReview,
  );
});

test("mergeHydratedInvoiceScanReview keeps the local completed review when the server payload downgrades", async () => {
  const { mergeHydratedInvoiceScanReview } = await getReviewStateModule();

  const currentReview = createReview({
    status: "completed",
    result: {
      supplierName: "Proveedor Uno",
      invoiceNumber: "A-0001",
      invoiceDate: "2026-05-26",
      currency: "ARS",
      notes: null,
      warnings: [],
      items: [
        {
          name: "Cemento",
          description: null,
          quantity: 2,
          unit: "bolsa",
          unitPrice: 3500,
        },
      ],
    },
  });
  const nextReview = createReview({
    status: "processing",
    result: null,
  });

  assert.deepEqual(
    mergeHydratedInvoiceScanReview(currentReview, nextReview),
    currentReview,
  );
});

test("mergeHydratedInvoiceScanReview preserves the current completed review on same-scan refreshes", async () => {
  const { mergeHydratedInvoiceScanReview } = await getReviewStateModule();

  const currentReview = createReview({
    fileName: "factura-editada.png",
    status: "completed",
    result: {
      supplierName: "Proveedor Uno",
      invoiceNumber: "A-0001",
      invoiceDate: "2026-05-26",
      currency: "ARS",
      notes: "editado localmente",
      warnings: [],
      items: [
        {
          name: "Cemento premium",
          description: "ajuste local",
          quantity: 2,
          unit: "bolsa",
          unitPrice: 3600,
        },
      ],
    },
  });
  const nextReview = createReview({
    fileName: "factura.png",
    status: "completed",
    result: {
      supplierName: "Proveedor Uno",
      invoiceNumber: "A-0001",
      invoiceDate: "2026-05-26",
      currency: "ARS",
      notes: null,
      warnings: [],
      items: [
        {
          name: "Cemento",
          description: null,
          quantity: 2,
          unit: "bolsa",
          unitPrice: 3500,
        },
      ],
    },
  });

  assert.deepEqual(
    mergeHydratedInvoiceScanReview(currentReview, nextReview),
    currentReview,
  );
});

test("mergeHydratedInvoiceScanReview clears the persisted review when there is no scan in the URL anymore", async () => {
  const { mergeHydratedInvoiceScanReview } = await getReviewStateModule();

  assert.equal(mergeHydratedInvoiceScanReview(createReview(), null), null);
});
