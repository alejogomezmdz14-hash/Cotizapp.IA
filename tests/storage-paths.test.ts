import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBusinessLogoPath,
  buildInvoiceUploadPath,
  buildQuotationAttachmentPath,
} from "../lib/storage/paths";

test("buildBusinessLogoPath keeps a stable logo location", () => {
  assert.equal(
    buildBusinessLogoPath("user-123", "logo principal.png"),
    "user-123/logo/logo principal.png",
  );
});

test("buildQuotationAttachmentPath creates unique sanitized object keys", () => {
  const firstPath = buildQuotationAttachmentPath(
    "user-123",
    "quote-456",
    "Factura Final 2026.pdf",
  );
  const secondPath = buildQuotationAttachmentPath(
    "user-123",
    "quote-456",
    "Factura Final 2026.pdf",
  );

  assert.match(
    firstPath,
    /^user-123\/quotations\/quote-456\/factura-final-2026-[a-f0-9-]+\.pdf$/,
  );
  assert.match(
    secondPath,
    /^user-123\/quotations\/quote-456\/factura-final-2026-[a-f0-9-]+\.pdf$/,
  );
  assert.notEqual(firstPath, secondPath);
});

test("buildInvoiceUploadPath creates unique sanitized object keys", () => {
  const firstPath = buildInvoiceUploadPath("user-123", "Mi Scan.JPG");
  const secondPath = buildInvoiceUploadPath("user-123", "Mi Scan.JPG");

  assert.match(firstPath, /^user-123\/invoices\/mi-scan-[a-f0-9-]+\.jpg$/);
  assert.match(secondPath, /^user-123\/invoices\/mi-scan-[a-f0-9-]+\.jpg$/);
  assert.notEqual(firstPath, secondPath);
});
