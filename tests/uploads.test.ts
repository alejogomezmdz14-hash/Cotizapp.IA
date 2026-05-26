import assert from "node:assert/strict";
import test from "node:test";

import * as uploadsModule from "../lib/uploads";
import {
  LOGO_UPLOAD_MAX_BYTES,
  QUOTATION_ATTACHMENT_MAX_BYTES,
  isPreviewableAttachmentType,
  parseLogoUploadFormData,
  parseQuotationAttachmentUploadFormData,
} from "../lib/uploads";

test("parseLogoUploadFormData accepts a supported logo image", () => {
  const formData = new FormData();
  const file = new File(["logo"], "logo-negocio.png", { type: "image/png" });
  formData.set("file", file);

  const result = parseLogoUploadFormData(formData);

  assert.equal(result.file.name, "logo-negocio.png");
  assert.equal(result.file.type, "image/png");
});

test("parseLogoUploadFormData rejects unsupported logo types", () => {
  const formData = new FormData();
  formData.set(
    "file",
    new File(["logo"], "logo.pdf", { type: "application/pdf" }),
  );

  assert.throws(
    () => parseLogoUploadFormData(formData),
    /El logo debe ser una imagen PNG, JPG o WEBP\./,
  );
});

test("parseLogoUploadFormData rejects oversized logos", () => {
  const formData = new FormData();
  formData.set(
    "file",
    new File([new Uint8Array(LOGO_UPLOAD_MAX_BYTES + 1)], "logo.png", {
      type: "image/png",
    }),
  );

  assert.throws(
    () => parseLogoUploadFormData(formData),
    /El logo supera el tamano maximo permitido de 5 MB\./,
  );
});

test("parseQuotationAttachmentUploadFormData accepts multiple files for one quotation", () => {
  const formData = new FormData();
  formData.set("quotationId", "quotation-123");
  formData.append(
    "files",
    new File(["uno"], "frente.jpg", { type: "image/jpeg" }),
  );
  formData.append(
    "files",
    new File(["dos"], "detalle.pdf", { type: "application/pdf" }),
  );

  const result = parseQuotationAttachmentUploadFormData(formData);

  assert.equal(result.quotationId, "quotation-123");
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0]?.name, "frente.jpg");
  assert.equal(result.files[1]?.name, "detalle.pdf");
});

test("parseQuotationAttachmentUploadFormData falls back to the singular file field", () => {
  const formData = new FormData();
  formData.set("quotationId", "quotation-123");
  formData.set(
    "file",
    new File(["detalle"], "detalle.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  );

  const result = parseQuotationAttachmentUploadFormData(formData);

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0]?.name, "detalle.docx");
});

test("parseQuotationAttachmentUploadFormData rejects missing quotation ids", () => {
  const formData = new FormData();
  formData.append(
    "files",
    new File(["uno"], "frente.jpg", { type: "image/jpeg" }),
  );

  assert.throws(
    () => parseQuotationAttachmentUploadFormData(formData),
    /Guarda la cotizacion borrador antes de subir adjuntos\./,
  );
});

test("parseQuotationAttachmentUploadFormData rejects oversized attachments", () => {
  const formData = new FormData();
  formData.set("quotationId", "quotation-123");
  formData.append(
    "files",
    new File(
      [new Uint8Array(QUOTATION_ATTACHMENT_MAX_BYTES + 1)],
      "detalle.pdf",
      { type: "application/pdf" },
    ),
  );

  assert.throws(
    () => parseQuotationAttachmentUploadFormData(formData),
    /Uno de los adjuntos supera el tamano maximo permitido de 10 MB\./,
  );
});

test("parseInvoiceUploadFormData accepts a supported invoice image", () => {
  const parseInvoiceUploadFormData = (
    uploadsModule as Record<string, unknown>
  ).parseInvoiceUploadFormData;

  assert.equal(typeof parseInvoiceUploadFormData, "function");

  const formData = new FormData();
  formData.set(
    "file",
    new File(["scan"], "factura-proveedor.jpg", { type: "image/jpeg" }),
  );

  const result = (
    parseInvoiceUploadFormData as (value: FormData) => { file: File }
  )(formData);

  assert.equal(result.file.name, "factura-proveedor.jpg");
  assert.equal(result.file.type, "image/jpeg");
});

test("parseInvoiceUploadFormData rejects unsupported invoice file types", () => {
  const parseInvoiceUploadFormData = (
    uploadsModule as Record<string, unknown>
  ).parseInvoiceUploadFormData;

  assert.equal(typeof parseInvoiceUploadFormData, "function");

  const formData = new FormData();
  formData.set(
    "file",
    new File(["pdf"], "factura.pdf", { type: "application/pdf" }),
  );

  assert.throws(
    () =>
      (parseInvoiceUploadFormData as (value: FormData) => { file: File })(
        formData,
      ),
    /La factura debe ser una imagen PNG, JPG o WEBP\./,
  );
});

test("isPreviewableAttachmentType detects previewable attachments", () => {
  assert.equal(isPreviewableAttachmentType("image/png"), true);
  assert.equal(isPreviewableAttachmentType("application/pdf"), true);
  assert.equal(
    isPreviewableAttachmentType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    false,
  );
  assert.equal(isPreviewableAttachmentType(null), false);
});
