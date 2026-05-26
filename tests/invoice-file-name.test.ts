import assert from "node:assert/strict";
import test from "node:test";

import { getInvoiceScanDisplayFileName } from "../lib/invoice-scan/file-name";

test("getInvoiceScanDisplayFileName prefers the original uploaded file name", () => {
  assert.equal(
    getInvoiceScanDisplayFileName({
      file_name: "factura_prueba.png",
      file_path: "user-1/invoices/factura-prueba-uuid.png",
    }),
    "factura_prueba.png",
  );
});

test("getInvoiceScanDisplayFileName falls back to the storage path when the original name is missing", () => {
  assert.equal(
    getInvoiceScanDisplayFileName({
      file_name: null,
      file_path: "user-1/invoices/factura-prueba-uuid.png",
    }),
    "factura-prueba-uuid.png",
  );
});
