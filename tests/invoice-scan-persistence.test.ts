import assert from "node:assert/strict";
import test from "node:test";

type InvoiceScanResultShape = {
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string | null;
  notes: string | null;
  items: Array<{
    name: string;
    description: string | null;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  warnings: string[];
};

type InvoiceScanShape = {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string | null;
  status: string | null;
  raw_result: Record<string, unknown> | null;
  created_at: string | null;
};

type PersistenceModule = {
  buildNewQuotationPageHref: (input: {
    quotationId?: string | null;
    scanId?: string | null;
  }) => string;
  hydratePersistedInvoiceScan: (
    scan: InvoiceScanShape | null,
  ) => {
    scanId: string;
    fileName: string;
    status: "uploaded" | "processing" | "failed" | "completed";
    failureMessage: string | null;
    result: InvoiceScanResultShape | null;
  } | null;
  resolvePersistedInvoiceScan: (
    scan: InvoiceScanShape | null,
  ) =>
    | {
        kind: "missing";
      }
    | {
        kind: "ready";
        review: {
          scanId: string;
          fileName: string;
          result: InvoiceScanResultShape;
        };
      }
    | {
        kind: "processing";
      }
    | {
        kind: "retryable";
        failureMessage: string | null;
      }
    | {
        kind: "invalid";
        reason: string;
      };
  processPersistedInvoiceScan: (
    dependencies: {
      getScan: (scanId: string) => Promise<InvoiceScanShape | null>;
      markProcessing: (scanId: string) => Promise<boolean>;
      getInvoiceImageDataUrl: (filePath: string) => Promise<string>;
      scanWithAi: (input: {
        imageDataUrl: string;
        fileName?: string | null;
      }) => Promise<{
        rawResult: Record<string, unknown>;
        result: InvoiceScanResultShape;
      }>;
      markCompleted: (
        scanId: string,
        rawResult: Record<string, unknown>,
      ) => Promise<boolean>;
      markFailed: (scanId: string, message: string) => Promise<boolean>;
    },
    input: {
      scanId: string;
    },
  ) => Promise<{
    scan: {
      id: string;
      filePath: string;
      fileName: string;
      createdAt: string | null;
      status: string | null;
    };
    result: InvoiceScanResultShape;
  }>;
};

async function getPersistenceModule() {
  const module = await import("../lib/invoice-scan/persistence").catch(() => null);
  assert.ok(module, "Expected ../lib/invoice-scan/persistence to exist.");

  return module as PersistenceModule;
}

function createCompletedResult(): InvoiceScanResultShape {
  return {
    supplierName: "Proveedor Demo",
    invoiceNumber: "A-0001-00001234",
    invoiceDate: "2026-05-25",
    currency: "ARS",
    notes: null,
    items: [
      {
        name: "Cemento",
        description: null,
        quantity: 2,
        unit: "bolsa",
        unitPrice: 3500,
      },
    ],
    warnings: [],
  };
}

function createScan(overrides: Partial<InvoiceScanShape> = {}): InvoiceScanShape {
  return {
    id: "scan-1",
    user_id: "user-1",
    file_path: "user-1/invoices/factura-demo.png",
    file_name: "factura-demo.png",
    status: "uploaded",
    raw_result: null,
    created_at: "2026-05-25T20:00:00.000Z",
    ...overrides,
  };
}

test("buildNewQuotationPageHref persists and clears scan ids without losing quotation ids", async () => {
  const { buildNewQuotationPageHref } = await getPersistenceModule();

  assert.equal(
    buildNewQuotationPageHref({
      quotationId: " quotation-7 ",
      scanId: " scan-3 ",
    }),
    "/cotizaciones/nueva?quotationId=quotation-7&scanId=scan-3",
  );
  assert.equal(
    buildNewQuotationPageHref({
      quotationId: "quotation-7",
      scanId: "   ",
    }),
    "/cotizaciones/nueva?quotationId=quotation-7",
  );
  assert.equal(buildNewQuotationPageHref({ scanId: null }), "/cotizaciones/nueva");
});

test("resolvePersistedInvoiceScan exposes a ready review only for completed scans with normalized results", async () => {
  const { resolvePersistedInvoiceScan } = await getPersistenceModule();
  const result = createCompletedResult();

  const resolved = resolvePersistedInvoiceScan(
    createScan({
      status: "completed",
      raw_result: {
        normalized: result,
      },
    }),
  );

  assert.deepEqual(resolved, {
    kind: "ready",
    review: {
      scanId: "scan-1",
      fileName: "factura-demo.png",
      status: "completed",
      failureMessage: null,
      result,
    },
  });
});

test("hydratePersistedInvoiceScan keeps stable scan references for uploaded and failed scans", async () => {
  const { hydratePersistedInvoiceScan } = await getPersistenceModule();

  assert.deepEqual(
    hydratePersistedInvoiceScan(
      createScan({
        status: "uploaded",
      }),
    ),
    {
      scanId: "scan-1",
      fileName: "factura-demo.png",
      status: "uploaded",
      failureMessage: null,
      result: null,
    },
  );

  assert.deepEqual(
    hydratePersistedInvoiceScan(
      createScan({
        status: "failed",
        raw_result: {
          error: "OpenAI timeout",
        },
      }),
    ),
    {
      scanId: "scan-1",
      fileName: "factura-demo.png",
      status: "failed",
      failureMessage: "OpenAI timeout",
      result: null,
    },
  );
});

test("resolvePersistedInvoiceScan flags completed scans missing normalized payload as invalid", async () => {
  const { resolvePersistedInvoiceScan } = await getPersistenceModule();

  assert.deepEqual(
    resolvePersistedInvoiceScan(
      createScan({
        status: "completed",
        raw_result: {
          content: "{\"items\":[]}",
        },
      }),
    ),
    {
      kind: "invalid",
      reason: "missing-normalized-result",
    },
  );
});

test("processPersistedInvoiceScan reuses cached completed scans without touching AI or transitions", async () => {
  const { processPersistedInvoiceScan } = await getPersistenceModule();
  const result = createCompletedResult();
  const calls: string[] = [];

  const response = await processPersistedInvoiceScan(
    {
      getScan: async (scanId) => {
        calls.push(`get:${scanId}`);
        return createScan({
          id: scanId,
          status: "completed",
          raw_result: {
            normalized: result,
          },
        });
      },
      markProcessing: async () => {
        calls.push("processing");
        return true;
      },
      getInvoiceImageDataUrl: async () => {
        calls.push("signed-url");
        return "https://signed.example/factura-demo.png";
      },
      scanWithAi: async () => {
        calls.push("ai");
        return {
          rawResult: {},
          result,
        };
      },
      markCompleted: async () => {
        calls.push("completed");
        return true;
      },
      markFailed: async () => {
        calls.push("failed");
        return true;
      },
    },
    {
      scanId: "scan-9",
    },
  );

  assert.deepEqual(response, {
    scan: {
      id: "scan-9",
      filePath: "user-1/invoices/factura-demo.png",
      fileName: "factura-demo.png",
      createdAt: "2026-05-25T20:00:00.000Z",
      status: "completed",
    },
    result,
  });
  assert.deepEqual(calls, ["get:scan-9"]);
});

test("processPersistedInvoiceScan rejects scans already marked as processing", async () => {
  const { processPersistedInvoiceScan } = await getPersistenceModule();

  await assert.rejects(
    () =>
      processPersistedInvoiceScan(
        {
          getScan: async () =>
            createScan({
              status: "processing",
            }),
          markProcessing: async () => true,
          getInvoiceImageDataUrl: async () => "https://signed.example/factura-demo.png",
          scanWithAi: async () => ({
            rawResult: {},
            result: createCompletedResult(),
          }),
          markCompleted: async () => true,
          markFailed: async () => true,
        },
        {
          scanId: "scan-1",
        },
      ),
    /ya se esta analizando/i,
  );
});

test("processPersistedInvoiceScan retries failed scans and persists the normalized payload", async () => {
  const { processPersistedInvoiceScan } = await getPersistenceModule();
  const result = createCompletedResult();
  const calls: string[] = [];
  let storedRawResult: Record<string, unknown> | null = null;

  const response = await processPersistedInvoiceScan(
    {
      getScan: async () =>
        createScan({
          status: "failed",
          raw_result: {
            error: "OpenAI timeout",
          },
        }),
      markProcessing: async (scanId) => {
        calls.push(`processing:${scanId}`);
        return true;
      },
      getInvoiceImageDataUrl: async (filePath) => {
        calls.push(`signed-url:${filePath}`);
        return "https://signed.example/factura-demo.png";
      },
      scanWithAi: async ({ imageDataUrl, fileName }) => {
        calls.push(`ai:${imageDataUrl}:${fileName ?? ""}`);
        return {
          rawResult: {
            provider: "openai",
          },
          result,
        };
      },
      markCompleted: async (scanId, rawResult) => {
        calls.push(`completed:${scanId}`);
        storedRawResult = rawResult;
        return true;
      },
      markFailed: async () => {
        calls.push("failed");
        return true;
      },
    },
    {
      scanId: "scan-1",
    },
  );

  assert.equal(response.scan.status, "completed");
  assert.deepEqual(response.result, result);
  assert.deepEqual(calls, [
    "processing:scan-1",
    "signed-url:user-1/invoices/factura-demo.png",
    "ai:https://signed.example/factura-demo.png:factura-demo.png",
    "completed:scan-1",
  ]);
  assert.deepEqual(storedRawResult, {
    provider: "openai",
    normalized: result,
  });
});

test("processPersistedInvoiceScan rechecks persisted state when processing lock is lost to a concurrent completion", async () => {
  const { processPersistedInvoiceScan } = await getPersistenceModule();
  const result = createCompletedResult();
  const calls: string[] = [];
  let getScanCallCount = 0;

  const response = await processPersistedInvoiceScan(
    {
      getScan: async () => {
        getScanCallCount += 1;
        calls.push(`get:${getScanCallCount}`);

        return getScanCallCount === 1
          ? createScan({
              status: "uploaded",
            })
          : createScan({
              status: "completed",
              raw_result: {
                normalized: result,
              },
            });
      },
      markProcessing: async () => {
        calls.push("processing");
        return false;
      },
      getInvoiceImageDataUrl: async () => {
        calls.push("signed-url");
        return "https://signed.example/factura-demo.png";
      },
      scanWithAi: async () => {
        calls.push("ai");
        return {
          rawResult: {},
          result,
        };
      },
      markCompleted: async () => {
        calls.push("completed");
        return true;
      },
      markFailed: async () => {
        calls.push("failed");
        return true;
      },
    },
    {
      scanId: "scan-1",
    },
  );

  assert.equal(response.scan.status, "completed");
  assert.deepEqual(response.result, result);
  assert.deepEqual(calls, ["get:1", "processing", "get:2"]);
});

test("processPersistedInvoiceScan rechecks persisted state when processing lock is lost to an in-flight scan", async () => {
  const { processPersistedInvoiceScan } = await getPersistenceModule();
  const calls: string[] = [];
  let getScanCallCount = 0;

  await assert.rejects(
    () =>
      processPersistedInvoiceScan(
        {
          getScan: async () => {
            getScanCallCount += 1;
            calls.push(`get:${getScanCallCount}`);

            return getScanCallCount === 1
              ? createScan({
                  status: "uploaded",
                })
              : createScan({
                  status: "processing",
                });
          },
          markProcessing: async () => {
            calls.push("processing");
            return false;
          },
          getInvoiceImageDataUrl: async () => {
            calls.push("signed-url");
            return "https://signed.example/factura-demo.png";
          },
          scanWithAi: async () => {
            calls.push("ai");
            return {
              rawResult: {},
              result: createCompletedResult(),
            };
          },
          markCompleted: async () => {
            calls.push("completed");
            return true;
          },
          markFailed: async () => {
            calls.push("failed");
            return true;
          },
        },
        {
          scanId: "scan-1",
        },
      ),
    /ya se esta analizando/i,
  );

  assert.deepEqual(calls, ["get:1", "processing", "get:2"]);
});
