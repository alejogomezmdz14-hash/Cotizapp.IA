import assert from "node:assert/strict";
import test from "node:test";

import { createQuotationShareRouteHandlers } from "../lib/quotation-share-route";

test("GET serves a shared quotation PDF through its stable token route", async () => {
  const calls: string[] = [];
  const { GET } = createQuotationShareRouteHandlers({
    getSharedQuotationPdf: async (shareToken) => {
      calls.push(shareToken);
      return {
        fileName: "cotizacion.pdf",
        generatedAt: "2026-05-26T01:10:00.000Z",
        bytes: Uint8Array.from([9, 8, 7]),
      };
    },
  });

  const response = await GET(
    new Request("http://localhost/api/quotations/share/share-token-1"),
    {
      params: Promise.resolve({ token: "share-token-1" }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.deepEqual(calls, ["share-token-1"]);
  assert.deepEqual(
    Array.from(new Uint8Array(await response.arrayBuffer())),
    [9, 8, 7],
  );
});

test("GET returns 400 when the share token is missing", async () => {
  const { GET } = createQuotationShareRouteHandlers({
    getSharedQuotationPdf: async () => {
      throw new Error("No deberia intentar leer el PDF compartido.");
    },
  });

  const response = await GET(
    new Request("http://localhost/api/quotations/share/"),
    {
      params: Promise.resolve({ token: "   " }),
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Falta indicar qué cotización compartida querés abrir.",
  });
});

test("GET returns 404 when the shared quotation PDF is unavailable", async () => {
  const { GET } = createQuotationShareRouteHandlers({
    getSharedQuotationPdf: async () => {
      throw new Error("La cotización compartida no existe o ya no está disponible.");
    },
  });

  const response = await GET(
    new Request("http://localhost/api/quotations/share/share-token-1"),
    {
      params: Promise.resolve({ token: "share-token-1" }),
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "La cotización compartida no existe o ya no está disponible.",
  });
});
