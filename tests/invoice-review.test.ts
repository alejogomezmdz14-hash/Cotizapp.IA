import assert from "node:assert/strict";
import test from "node:test";

type ReviewModule = {
  createInvoiceReviewItems: (input: {
    supplierName: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    currency: string | null;
    notes: string | null;
    warnings: string[];
    items: Array<{
      name: string;
      description: string | null;
      quantity: number;
      unit: string;
      unitPrice: number;
    }>;
  } | null) => Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    destination: "quotation" | "catalog" | "discard";
  }>;
  updateInvoiceReviewDestination: (
    rows: Array<{
      id: string;
      destination: "quotation" | "catalog" | "discard";
    }>,
    rowId: string,
    destination: "quotation" | "catalog" | "discard",
  ) => Array<{
    id: string;
    destination: "quotation" | "catalog" | "discard";
  }>;
  markSavedCatalogRows: (
    rows: Array<{
      id: string;
      destination: "quotation" | "catalog" | "discard";
    }>,
    savedRowIds: string[],
  ) => Array<{
    id: string;
    destination: "quotation" | "catalog" | "discard";
  }>;
  removeAppliedQuotationRows: (
    rows: Array<{
      id: string;
      destination: "quotation" | "catalog" | "discard";
    }>,
  ) => Array<{
    id: string;
    destination: "quotation" | "catalog" | "discard";
  }>;
};

async function getReviewModule() {
  const reviewModule = await import("../lib/invoice-scan/review").catch(
    () => null,
  );
  assert.ok(reviewModule, "Expected ../lib/invoice-scan/review to exist.");

  return reviewModule as ReviewModule;
}

test("createInvoiceReviewItems defaults each scanned row to quotation destination", async () => {
  const { createInvoiceReviewItems } = await getReviewModule();

  const rows = createInvoiceReviewItems({
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    currency: null,
    notes: null,
    warnings: [],
    items: [
      {
        name: "Cemento",
        description: null,
        quantity: 2,
        unit: "bolsa",
        unitPrice: 3500,
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.destination, "quotation");
});

test("updateInvoiceReviewDestination keeps a single destination per row", async () => {
  const { createInvoiceReviewItems, updateInvoiceReviewDestination } =
    await getReviewModule();

  const rows = createInvoiceReviewItems({
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    currency: null,
    notes: null,
    warnings: [],
    items: [
      {
        name: "Cemento",
        description: null,
        quantity: 2,
        unit: "bolsa",
        unitPrice: 3500,
      },
    ],
  });

  const catalogRows = updateInvoiceReviewDestination(
    rows,
    "invoice-item-1",
    "catalog",
  );
  assert.equal(catalogRows[0]?.destination, "catalog");

  const discardedRows = updateInvoiceReviewDestination(
    catalogRows,
    "invoice-item-1",
    "discard",
  );
  assert.equal(discardedRows[0]?.destination, "discard");
});

test("markSavedCatalogRows only discards rows actually persisted", async () => {
  const {
    createInvoiceReviewItems,
    updateInvoiceReviewDestination,
    markSavedCatalogRows,
  } = await getReviewModule();

  const rows = createInvoiceReviewItems({
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    currency: null,
    notes: null,
    warnings: [],
    items: [
      {
        name: "Cemento",
        description: null,
        quantity: 2,
        unit: "bolsa",
        unitPrice: 3500,
      },
      {
        name: "Arena",
        description: null,
        quantity: 1,
        unit: "m3",
        unitPrice: 0,
      },
    ],
  });

  const selectedForCatalog = updateInvoiceReviewDestination(
    updateInvoiceReviewDestination(rows, "invoice-item-1", "catalog"),
    "invoice-item-2",
    "catalog",
  );

  const afterPartialSave = markSavedCatalogRows(selectedForCatalog, [
    "invoice-item-1",
  ]);

  assert.deepEqual(afterPartialSave, [
    {
      ...selectedForCatalog[0],
      destination: "discard",
    },
    {
      ...selectedForCatalog[1],
      destination: "catalog",
    },
  ]);
});

test("removeAppliedQuotationRows removes only the rows that were added to the quotation", async () => {
  const {
    createInvoiceReviewItems,
    updateInvoiceReviewDestination,
    removeAppliedQuotationRows,
  } = await getReviewModule();

  const rows = createInvoiceReviewItems({
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    currency: null,
    notes: null,
    warnings: [],
    items: [
      {
        name: "Laptop HP 15",
        description: null,
        quantity: 2,
        unit: "unidad",
        unitPrice: 120000,
      },
      {
        name: "Mouse Logitech",
        description: null,
        quantity: 5,
        unit: "unidad",
        unitPrice: 3500,
      },
    ],
  });

  const mixedDestinations = updateInvoiceReviewDestination(
    rows,
    "invoice-item-2",
    "catalog",
  );

  assert.deepEqual(removeAppliedQuotationRows(mixedDestinations), [
    {
      ...mixedDestinations[1],
      destination: "catalog",
    },
  ]);
});
