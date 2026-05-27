import assert from "node:assert/strict";
import test from "node:test";

import { buildQuotationPdfTemplateData } from "../components/cotizacion/quotation-pdf-template";
import { formatCurrencyAmount, formatPercentage } from "../lib/formatting";
import { buildProfileLogoDataUrl, resolveProfileBranding } from "../lib/profile";
import { generateAndStoreQuotationPdf, getStoredQuotationPdf } from "../lib/quotations";
import { buildQuotationPdfPath } from "../lib/storage/paths";
import type { HydratedQuotation, Profile } from "../types";

function createHydratedQuotation(): HydratedQuotation {
  return {
    quotation: {
      id: "quotation-1",
      user_id: "user-1",
      client_id: "client-1",
      client_name: "Cliente Demo",
      number: "COT-20260525-145607-A1B2C3",
      status: "pending",
      notes: "Entregar en obra y coordinar descarga.",
      subtotal: 2400.5,
      tax_rate: 21,
      total: 2904.61,
      valid_until: "2026-06-30",
      pdf_path: null,
      pdf_generated_at: null,
      share_token: null,
      sent_at: null,
      created_at: "2026-05-25T15:10:00.000Z",
    },
    branding: {
      businessName: "Pro Mat Mendoza",
      logoPath: "user-1/logo/logo.png",
      logoUrl: null,
      phone: "2615551234",
      email: "ventas@promat.com",
      address: "Rodriguez Pena 3341",
      currency: "ARS",
      pdfFooter: "Precios sujetos a cambios sin previo aviso.",
      pdfAccentColor: "#3B82F6",
      pdfTemplate: "classic",
    },
    customer: {
      id: "client-1",
      name: "Cliente Demo",
      email: "cliente@demo.com",
      phone: "2614440000",
      address: "Obra central",
    },
    items: [
      {
        id: "item-1",
        quotationId: "quotation-1",
        position: 0,
        catalogItemId: "catalog-1",
        name: "Cemento",
        description: "Bolsa de 50 kg",
        quantity: 2,
        unit: "bolsa",
        unitPrice: 1200.25,
        total: 2400.5,
      },
    ],
    output: {
      pdfPath: null,
      pdfGeneratedAt: null,
      shareToken: null,
      sentAt: null,
    },
  };
}

test("buildQuotationPdfPath keeps a deterministic PDF location per quotation", () => {
  const firstPath = buildQuotationPdfPath(
    "user-123",
    "quote-456",
    "COT-2026/05 Demo #01",
  );
  const secondPath = buildQuotationPdfPath(
    "user-123",
    "quote-456",
    "COT-2026/05 Demo #01",
  );

  assert.equal(
    firstPath,
    "user-123/quotation-pdfs/quote-456/cot-2026-05-demo-01.pdf",
  );
  assert.equal(secondPath, firstPath);
});

test("resolveProfileBranding trims profile values for PDF generation", () => {
  assert.deepEqual(
    resolveProfileBranding({
      id: "user-1",
      business_name: "  Pro Mat Mendoza  ",
      industry: "Materiales",
      logo_url: " user-1/logo/logo.png ",
      phone: " 2615551234 ",
      email: " ventas@promat.com ",
      address: " Rodriguez Pena 3341 ",
      currency: " ars ",
      theme: "dark",
      created_at: "2026-01-01T00:00:00.000Z",
    } as Profile),
    {
      businessName: "Pro Mat Mendoza",
      logoPath: "user-1/logo/logo.png",
      logoUrl: null,
      phone: "2615551234",
      email: "ventas@promat.com",
      address: "Rodriguez Pena 3341",
      currency: "ars",
      pdfFooter: null,
      pdfAccentColor: "#3B82F6",
      pdfTemplate: "classic",
    },
  );
});

test("buildProfileLogoDataUrl ignores WEBP logos that React PDF cannot embed", () => {
  assert.equal(
    buildProfileLogoDataUrl({
      bytes: Uint8Array.from([82, 73, 70, 70]),
      contentType: "image/webp",
    }),
    null,
  );
});

test("buildQuotationPdfTemplateData provides safe fallbacks and formatted line items", () => {
  const quotation = createHydratedQuotation();
  quotation.branding = {
    businessName: null,
    logoPath: null,
    logoUrl: null,
    phone: null,
    email: null,
    address: null,
    currency: "ARS",
    pdfFooter: null,
    pdfAccentColor: "#3B82F6",
    pdfTemplate: "classic",
  };
  quotation.customer.name = null;
  quotation.quotation.notes = "   ";
  quotation.quotation.valid_until = null;

  const templateData = buildQuotationPdfTemplateData({
    quotation,
    generatedAt: "2026-05-26T01:10:00.000Z",
    logoDataUrl: null,
  });

  assert.equal(templateData.businessName, "Cotizapp");
  assert.equal(templateData.customerName, "Cliente no especificado");
  assert.equal(templateData.validUntilLabel, "Sin fecha");
  assert.equal(templateData.notes, null);
  assert.equal(templateData.items[0]?.quantityLabel, "2");
  assert.equal(
    templateData.items[0]?.unitPriceLabel,
    formatCurrencyAmount(1200.25, quotation.branding.currency),
  );
  assert.equal(templateData.items[0]?.description, "Bolsa de 50 kg");
});

test("buildQuotationPdfTemplateData keeps subtotal, tax and total labels ready for the summary block", () => {
  const quotation = createHydratedQuotation();
  const templateData = buildQuotationPdfTemplateData({
    quotation,
    generatedAt: "2026-05-26T01:10:00.000Z",
    logoDataUrl: null,
  });

  assert.equal(
    templateData.subtotalLabel,
    formatCurrencyAmount(quotation.quotation.subtotal, quotation.branding.currency),
  );
  assert.equal(
    templateData.taxAmountLabel,
    formatCurrencyAmount(
      (quotation.quotation.total ?? 0) - (quotation.quotation.subtotal ?? 0),
      quotation.branding.currency,
    ),
  );
  assert.equal(
    templateData.totalLabel,
    formatCurrencyAmount(quotation.quotation.total, quotation.branding.currency),
  );
  assert.equal(
    templateData.taxRateLabel,
    formatPercentage(quotation.quotation.tax_rate),
  );
});

test("generateAndStoreQuotationPdf renders, uploads and persists the latest PDF metadata", async () => {
  const quotation = createHydratedQuotation();
  const uploadCalls: Array<{ path: string; contentType: string; size: number }> = [];
  const outputUpdates: Array<{ pdfPath: string; pdfGeneratedAt: string }> = [];
  const renderCalls: string[] = [];

  const result = await generateAndStoreQuotationPdf(
    {
      getHydratedQuotation: async () => quotation,
      resolveLogoDataUrl: async () => "data:image/png;base64,logo",
      renderPdf: async (templateData) => {
        renderCalls.push(templateData.quotationNumber);
        return Uint8Array.from([1, 2, 3, 4]);
      },
      uploadPdf: async ({ path, bytes, contentType }) => {
        uploadCalls.push({
          path,
          contentType,
          size: bytes.byteLength,
        });
      },
      updateOutput: async (values) => {
        outputUpdates.push(values);
      },
      removeUploadedPdf: async () => {},
    },
    {
      userId: "user-1",
      quotationId: "quotation-1",
      now: new Date("2026-05-26T01:10:00.000Z"),
    },
  );

  assert.equal(result.fileName, "cot-20260525-145607-a1b2c3.pdf");
  assert.equal(
    result.path,
    "user-1/quotation-pdfs/quotation-1/cot-20260525-145607-a1b2c3.pdf",
  );
  assert.deepEqual(renderCalls, ["COT-20260525-145607-A1B2C3"]);
  assert.deepEqual(uploadCalls, [
    {
      path: "user-1/quotation-pdfs/quotation-1/cot-20260525-145607-a1b2c3.pdf",
      contentType: "application/pdf",
      size: 4,
    },
  ]);
  assert.deepEqual(outputUpdates, [
    {
      pdfPath: "user-1/quotation-pdfs/quotation-1/cot-20260525-145607-a1b2c3.pdf",
      pdfGeneratedAt: "2026-05-26T01:10:00.000Z",
    },
  ]);
  assert.equal(result.bytes.byteLength, 4);
});

test("generateAndStoreQuotationPdf keeps the existing share token so regenerated PDFs can refresh the public copy", async () => {
  const quotation = createHydratedQuotation();
  quotation.output.shareToken = "share-token-1";

  const result = await generateAndStoreQuotationPdf(
    {
      getHydratedQuotation: async () => quotation,
      resolveLogoDataUrl: async () => null,
      renderPdf: async () => Uint8Array.from([1, 2, 3]),
      uploadPdf: async () => {},
      updateOutput: async () => {},
      removeUploadedPdf: async () => {},
    },
    {
      userId: "user-1",
      quotationId: "quotation-1",
      now: new Date("2026-05-26T01:10:00.000Z"),
    },
  );

  assert.equal(result.shareToken, "share-token-1");
});

test("generateAndStoreQuotationPdf removes a freshly uploaded PDF when metadata persistence fails on first generation", async () => {
  const quotation = createHydratedQuotation();
  const removedPaths: string[] = [];

  await assert.rejects(
    () =>
      generateAndStoreQuotationPdf(
        {
          getHydratedQuotation: async () => quotation,
          resolveLogoDataUrl: async () => null,
          renderPdf: async () => Uint8Array.from([1, 2, 3]),
          uploadPdf: async () => {},
          updateOutput: async () => {
            throw new Error("No se pudo guardar la ruta del PDF.");
          },
          removeUploadedPdf: async (path) => {
            removedPaths.push(path);
          },
        },
        {
          userId: "user-1",
          quotationId: "quotation-1",
          now: new Date("2026-05-26T01:10:00.000Z"),
        },
      ),
    /No se pudo guardar la ruta del PDF\./,
  );

  assert.deepEqual(removedPaths, [
    "user-1/quotation-pdfs/quotation-1/cot-20260525-145607-a1b2c3.pdf",
  ]);
});

test("getStoredQuotationPdf returns the persisted bytes without regenerating metadata", async () => {
  const quotation = createHydratedQuotation();
  quotation.output.pdfPath = "user-1/quotation-pdfs/quotation-1/cot-20260525-145607-a1b2c3.pdf";
  quotation.output.pdfGeneratedAt = "2026-05-26T01:10:00.000Z";

  const result = await getStoredQuotationPdf(
    {
      getHydratedQuotation: async () => quotation,
      downloadPdf: async (path) => {
        assert.equal(
          path,
          "user-1/quotation-pdfs/quotation-1/cot-20260525-145607-a1b2c3.pdf",
        );

        return Uint8Array.from([7, 8, 9]);
      },
    },
  );

  assert.equal(result.fileName, "cot-20260525-145607-a1b2c3.pdf");
  assert.equal(result.generatedAt, "2026-05-26T01:10:00.000Z");
  assert.deepEqual(Array.from(result.bytes), [7, 8, 9]);
});
