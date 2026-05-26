import assert from "node:assert/strict";
import test from "node:test";

import { createQuotationPdfRouteHandlers } from "../lib/quotation-pdf-route";

test("GET serves an existing persisted PDF without triggering generation", async () => {
  const calls: string[] = [];
  const { GET } = createQuotationPdfRouteHandlers({
    getCurrentUser: async () => ({ id: "user-1" }),
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
  });

  const response = await GET(new Request("http://localhost/api/quotations/quotation-1/pdf"), {
    params: Promise.resolve({ id: "quotation-1" }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.deepEqual(calls, ["get-stored"]);
  assert.deepEqual(
    Array.from(new Uint8Array(await response.arrayBuffer())),
    [1, 2, 3],
  );
});

test("POST generates and persists the PDF explicitly", async () => {
  const calls: string[] = [];
  const { POST } = createQuotationPdfRouteHandlers({
    getCurrentUser: async () => ({ id: "user-1" }),
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
  });

  const response = await POST(new Request("http://localhost/api/quotations/quotation-1/pdf", {
    method: "POST",
  }), {
    params: Promise.resolve({ id: "quotation-1" }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.deepEqual(calls, ["generate"]);
  assert.deepEqual(
    Array.from(new Uint8Array(await response.arrayBuffer())),
    [4, 5, 6],
  );
});
