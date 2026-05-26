import assert from "node:assert/strict";
import test from "node:test";

type InvoiceModule = {
  normalizeInvoiceScanResult: (input: unknown) => {
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
  sanitizeInvoiceReviewItemsForCatalog: (
    input: unknown,
  ) => Array<{
    name: string;
    description: string | null;
    unit: string;
    price: number;
  }>;
};

async function getInvoiceModule() {
  const invoiceModule = await import("../lib/ai/invoice").catch(() => null);
  assert.ok(invoiceModule, "Expected ../lib/ai/invoice to exist.");

  return invoiceModule as InvoiceModule;
}

test("normalizeInvoiceScanResult normalizes alternative keys and numeric strings", async () => {
  const { normalizeInvoiceScanResult } = await getInvoiceModule();

  const result = normalizeInvoiceScanResult({
    supplier_name: " Ferreteria Uno ",
    invoice_number: " A-0001-00001234 ",
    line_items: [
      {
        product: " Cemento portland x 50 kg ",
        detail: "Marca premium",
        qty: "2",
        unit: " bolsa ",
        unit_price: "3450,50",
      },
      {
        concept: "Arena fina",
        cantidad: "1.5",
        precio: "25000",
      },
    ],
  });

  assert.deepEqual(result, {
    supplierName: "Ferreteria Uno",
    invoiceNumber: "A-0001-00001234",
    invoiceDate: null,
    currency: null,
    notes: null,
    items: [
      {
        name: "Cemento portland x 50 kg",
        description: "Marca premium",
        quantity: 2,
        unit: "bolsa",
        unitPrice: 3450.5,
      },
      {
        name: "Arena fina",
        description: null,
        quantity: 1.5,
        unit: "unidad",
        unitPrice: 25000,
      },
    ],
    warnings: [],
  });
});

test("normalizeInvoiceScanResult drops empty rows and warns when values are repaired", async () => {
  const { normalizeInvoiceScanResult } = await getInvoiceModule();

  const result = normalizeInvoiceScanResult({
    notes: " revisar importes ",
    items: [
      {
        description: "   ",
      },
      {
        name: "Pintura latex interior",
        quantity: "0",
        unit_price: "texto",
      },
      {
        item_name: "Rodillo",
        qty: "3",
        price: "1499.99",
      },
    ],
  });

  assert.equal(result.notes, "revisar importes");
  assert.deepEqual(result.items, [
    {
      name: "Pintura latex interior",
      description: null,
      quantity: 1,
      unit: "unidad",
      unitPrice: 0,
    },
    {
      name: "Rodillo",
      description: null,
      quantity: 3,
      unit: "unidad",
      unitPrice: 1499.99,
    },
  ]);
  assert.match(
    result.warnings.join(" "),
    /Se omitieron 1 filas? vacias?.*Se ajustaron 1 cantidades?.*Se ajustaron 1 precios?/,
  );
});

test("normalizeInvoiceScanResult parses grouped decimal formats used in invoices", async () => {
  const { normalizeInvoiceScanResult, sanitizeInvoiceReviewItemsForCatalog } =
    await getInvoiceModule();

  const result = normalizeInvoiceScanResult({
    items: [
      {
        name: "Hierro del 8",
        qty: "1,25",
        unit_price: "1.234,56",
      },
      {
        name: "Malla electrosoldada",
        qty: "2",
        unit_price: "1,234.56",
      },
    ],
  });

  assert.deepEqual(result.items, [
    {
      name: "Hierro del 8",
      description: null,
      quantity: 1.25,
      unit: "unidad",
      unitPrice: 1234.56,
    },
    {
      name: "Malla electrosoldada",
      description: null,
      quantity: 2,
      unit: "unidad",
      unitPrice: 1234.56,
    },
  ]);

  assert.deepEqual(
    sanitizeInvoiceReviewItemsForCatalog([
      {
        name: "Cemento",
        unitPrice: "12.345,67",
      },
      {
        name: "Arena",
        unitPrice: "12,345.67",
      },
    ]),
    [
      {
        name: "Cemento",
        description: null,
        unit: "unidad",
        price: 12345.67,
      },
      {
        name: "Arena",
        description: null,
        unit: "unidad",
        price: 12345.67,
      },
    ],
  );
});

test("normalizeInvoiceScanResult accepts broader metadata aliases from invoice scans", async () => {
  const { normalizeInvoiceScanResult } = await getInvoiceModule();

  const result = normalizeInvoiceScanResult({
    company: "Proveedor Demo SA",
    invoice_no: "B-0003-00004567",
    moneda: "ARS",
    issued_at: "2026-05-25",
    products: [
      {
        product_name: "Teclado mecanico",
        qty: "3",
        unit_price: "12500",
      },
    ],
  });

  assert.equal(result.supplierName, "Proveedor Demo SA");
  assert.equal(result.invoiceNumber, "B-0003-00004567");
  assert.equal(result.currency, "ARS");
  assert.equal(result.invoiceDate, "2026-05-25");
});

test("sanitizeInvoiceReviewItemsForCatalog only keeps valid explicit catalog drafts", async () => {
  const { sanitizeInvoiceReviewItemsForCatalog } = await getInvoiceModule();

  const result = sanitizeInvoiceReviewItemsForCatalog([
    {
      name: " Cemento ",
      description: " Bolsa x 50 kg ",
      unit: "",
      unitPrice: "1234,50",
    },
    {
      description: "Sin nombre",
      unitPrice: 200,
    },
    {
      name: "Arena fina",
      unit: "m3",
      unitPrice: -10,
    },
  ]);

  assert.deepEqual(result, [
    {
      name: "Cemento",
      description: "Bolsa x 50 kg",
      unit: "unidad",
      price: 1234.5,
    },
  ]);
});
