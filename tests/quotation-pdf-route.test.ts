import assert from "node:assert/strict";
import test from "node:test";

import { createQuotationPdfRouteHandlers } from "../lib/quotation-pdf-route";

test("GET serves an existing persisted PDF without triggering generation", async () => {
  const calls: string[] = [];
  const { GET } = createQuotationPdfRouteHandlers({
    getCurrentUser: async () => ({ id: "user-1", clerkId: "user-1", email: null }),
    generateQuotationPdfForUser: async () => {
      calls.push("generate");
      throw new Error("GET no debe generar PDFs.");
    },
    getStoredQuotationPdfForUser: async () => {
      calls.push("get-stored");
      return {
        fileName: "cotizacion.pdf",
        generatedAt: "2026-05-26T01:10:00.000Z",
        bytes: Uint8Array.from([1, 2, 3]),
      };
    },
  } as unknown as Parameters<typeof createQuotationPdfRouteHandlers>[0]);

  const response = await GET(new Request("http://localhost/api/quotations/quotation-1/pdf"), {
    params: Promise.resolve({ id: "quotation-1" }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(
    response.headers.get("Content-Disposition"),
    'inline; filename="cotizacion.pdf"',
  );
  assert.deepEqual(calls, ["get-stored"]);
  assert.deepEqual(
    Array.from(new Uint8Array(await response.arrayBuffer())),
    [1, 2, 3],
  );
});

test("GET falls back to regeneration when stored PDF is missing", async () => {
  const calls: string[] = [];
  const { GET } = createQuotationPdfRouteHandlers({
    getCurrentUser: async () => ({ id: "user-1", clerkId: "user-1", email: null }),
    generateQuotationPdfForUser: async () => {
      calls.push("generate");
      return {
        fileName: "cotizacion-regenerada.pdf",
        generatedAt: "2026-05-26T01:11:00.000Z",
        bytes: Uint8Array.from([9, 8, 7]),
      };
    },
    getStoredQuotationPdfForUser: async () => {
      calls.push("get-stored");
      throw new Error("Object not found");
    },
  } as unknown as Parameters<typeof createQuotationPdfRouteHandlers>[0]);

  const response = await GET(
    new Request("http://localhost/api/quotations/quotation-1/pdf"),
    {
      params: Promise.resolve({ id: "quotation-1" }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(
    response.headers.get("Content-Disposition"),
    'inline; filename="cotizacion-regenerada.pdf"',
  );
  assert.deepEqual(calls, ["get-stored", "generate"]);
  assert.deepEqual(
    Array.from(new Uint8Array(await response.arrayBuffer())),
    [9, 8, 7],
  );
});

test("POST generates and persists the PDF explicitly", async () => {
  const calls: string[] = [];
  const { POST } = createQuotationPdfRouteHandlers({
    getCurrentUser: async () => ({ id: "user-1", clerkId: "user-1", email: null }),
    generateQuotationPdfForUser: async () => {
      calls.push("generate");
      return {
        fileName: "cotizacion.pdf",
        generatedAt: "2026-05-26T01:10:00.000Z",
        bytes: Uint8Array.from([4, 5, 6]),
      };
    },
    getStoredQuotationPdfForUser: async () => {
      calls.push("get-stored");
      throw new Error("POST no debe leer solamente el PDF persistido.");
    },
  } as unknown as Parameters<typeof createQuotationPdfRouteHandlers>[0]);

  const response = await POST(new Request("http://localhost/api/quotations/quotation-1/pdf", {
    method: "POST",
  }), {
    params: Promise.resolve({ id: "quotation-1" }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.equal(
    response.headers.get("Content-Disposition"),
    'attachment; filename="cotizacion.pdf"',
  );
  assert.deepEqual(calls, ["generate"]);
  assert.deepEqual(
    Array.from(new Uint8Array(await response.arrayBuffer())),
    [4, 5, 6],
  );
});
