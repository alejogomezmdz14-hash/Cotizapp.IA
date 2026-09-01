import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBusinessLogoPath,
  buildExpenseReceiptPath,
  buildInvoiceUploadPath,
  buildQuotationAttachmentPath,
  buildSharedQuotationPdfPath,
  isExpenseReceiptPathForUser,
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

test("buildSharedQuotationPdfPath keeps a deterministic public path per user and share token", () => {
  assert.equal(
    buildSharedQuotationPdfPath("user-123", "share-token-456"),
    "user-123/quotation-share-pdfs/share-token-456.pdf",
  );
});

const RECEIPT_OWNER = "11111111-1111-4111-8111-111111111111";
const RECEIPT_OTHER = "22222222-2222-4222-8222-222222222222";

test("isExpenseReceiptPathForUser accepts the paths buildExpenseReceiptPath produces", () => {
  const withExtension = buildExpenseReceiptPath(RECEIPT_OWNER, "Ticket Nafta 2026.JPG");
  const withoutExtension = buildExpenseReceiptPath(RECEIPT_OWNER, "ticket sin extension");

  assert.equal(isExpenseReceiptPathForUser(RECEIPT_OWNER, withExtension), true);
  assert.equal(isExpenseReceiptPathForUser(RECEIPT_OWNER, withoutExtension), true);
});

test("isExpenseReceiptPathForUser rejects traversal that a prefix check would let through", () => {
  // El chequeo viejo era receiptPath.startsWith(`${user.id}/`), así que estas
  // dos rutas pasaban: empiezan con el id del dueño y salen de su carpeta.
  const escapesFromRoot = `${RECEIPT_OWNER}/../${RECEIPT_OTHER}/receipts/recibo.png`;
  const escapesFromReceipts = `${RECEIPT_OWNER}/receipts/../../${RECEIPT_OTHER}/receipts/recibo.png`;

  assert.equal(isExpenseReceiptPathForUser(RECEIPT_OWNER, escapesFromRoot), false);
  assert.equal(isExpenseReceiptPathForUser(RECEIPT_OWNER, escapesFromReceipts), false);
});

test("isExpenseReceiptPathForUser rejects another user, other folders and empty input", () => {
  const otherUsersReceipt = buildExpenseReceiptPath(RECEIPT_OTHER, "recibo.png");

  assert.equal(isExpenseReceiptPathForUser(RECEIPT_OWNER, otherUsersReceipt), false);
  assert.equal(
    isExpenseReceiptPathForUser(RECEIPT_OWNER, `${RECEIPT_OWNER}/logo/logo.png`),
    false,
  );
  assert.equal(
    isExpenseReceiptPathForUser(RECEIPT_OWNER, `${RECEIPT_OWNER}/receipts/sub/recibo.png`),
    false,
  );
  assert.equal(isExpenseReceiptPathForUser(RECEIPT_OWNER, ""), false);
  assert.equal(isExpenseReceiptPathForUser("", `${RECEIPT_OWNER}/receipts/recibo.png`), false);
});

test("el nombre de recibo no acepta cualquier caracter donde va el punto", () => {
  // El punto estaba sin escapar en el regex, así que `ab/cd` pasaba la
  // validación aunque el comentario de al lado dijera que cualquier barra la
  // rechaza. No era explotable (`..` y `a/b/c` seguían fuera, y todo queda bajo
  // <userId>/receipts/), pero la validación era más laxa de lo que declaraba.
  const userId = "11111111-1111-1111-1111-111111111111";

  assert.equal(
    isExpenseReceiptPathForUser(userId, `${userId}/receipts/recibo-1.png`),
    true,
  );

  for (const nombre of ["ab/cd", "ab cd", "ab:cd", "ab\\cd", "AB.PNG", "ab..png"]) {
    assert.equal(
      isExpenseReceiptPathForUser(userId, `${userId}/receipts/${nombre}`),
      false,
      `"${nombre}" no debería pasar la validación`,
    );
  }
});
