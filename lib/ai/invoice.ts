import { normalizeCatalogUnit } from "@/lib/catalog";
import type {
  InvoiceCatalogDraft,
  InvoiceScanItemDraft,
  InvoiceScanResult,
} from "@/types";

export type NormalizedInvoiceScanResult = InvoiceScanResult;

type InvoiceItemNormalizationStats = {
  omittedRows: number;
  repairedQuantities: number;
  repairedPrices: number;
};

type ScanInvoiceWithAiInput = {
  signedUrl: string;
  fileName?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function getFirstString(
  source: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = getTrimmedString(source[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function normalizeNumericText(value: string) {
  const compactValue = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!compactValue || !/\d/.test(compactValue)) {
    return null;
  }

  const isNegative = compactValue.startsWith("-");
  const unsignedValue = isNegative ? compactValue.slice(1) : compactValue;
  const lastCommaIndex = unsignedValue.lastIndexOf(",");
  const lastDotIndex = unsignedValue.lastIndexOf(".");

  const prependSign = (numericText: string) =>
    isNegative ? `-${numericText}` : numericText;

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const thousandsPattern = decimalSeparator === "," ? /\./g : /,/g;

    return prependSign(
      unsignedValue
        .replace(thousandsPattern, "")
        .replace(decimalSeparator, "."),
    );
  }

  const separator = lastCommaIndex !== -1 ? "," : lastDotIndex !== -1 ? "." : null;

  if (!separator) {
    return prependSign(unsignedValue);
  }

  const parts = unsignedValue.split(separator);

  if (
    parts.length > 1 &&
    parts.every((part, index) =>
      index === 0 ? /^\d{1,3}$/.test(part) : /^\d{3}$/.test(part),
    )
  ) {
    return prependSign(parts.join(""));
  }

  if (parts.length === 2) {
    const [integerPart, decimalPart] = parts;

    if (
      integerPart &&
      decimalPart &&
      /^\d+$/.test(integerPart) &&
      /^\d+$/.test(decimalPart)
    ) {
      if (decimalPart.length === 3 && integerPart.length <= 3) {
        return prependSign(`${integerPart}${decimalPart}`);
      }

      return prependSign(`${integerPart}.${decimalPart}`);
    }
  }

  const lastSeparatorIndex = unsignedValue.lastIndexOf(separator);

  return prependSign(
    unsignedValue
      .slice(0, lastSeparatorIndex)
      .replace(new RegExp(`\\${separator}`, "g"), "") +
      "." +
      unsignedValue.slice(lastSeparatorIndex + 1),
  );
}

function parseDecimal(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = normalizeNumericText(value);

  if (!normalizedValue || !/^-?\d+(?:\.\d+)?$/.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getCandidateItems(source: Record<string, unknown>) {
  const collectionKeys = [
    "items",
    "line_items",
    "lineItems",
    "products",
    "rows",
  ] as const;

  for (const key of collectionKeys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function normalizeInvoiceItem(
  value: unknown,
  stats: InvoiceItemNormalizationStats,
) {
  if (!isRecord(value)) {
    stats.omittedRows += 1;
    return null;
  }

  const name =
    getFirstString(value, [
      "name",
      "product",
      "product_name",
      "productName",
      "concept",
      "item",
      "item_name",
      "itemName",
      "description",
    ]) ?? null;

  if (!name) {
    stats.omittedRows += 1;
    return null;
  }

  const description =
    getFirstString(value, [
      "detail",
      "details",
      "notes",
      "item_detail",
      "itemDetail",
      "item_description",
      "itemDescription",
    ]) ?? null;

  const parsedQuantity = parseDecimal(
    value.quantity ?? value.qty ?? value.cantidad,
  );
  const parsedUnitPrice = parseDecimal(
    value.unitPrice ??
      value.unit_price ??
      value.price ??
      value.precio ??
      value.importe,
  );

  const quantity =
    parsedQuantity !== null && parsedQuantity > 0 ? parsedQuantity : 1;
  const unitPrice =
    parsedUnitPrice !== null && parsedUnitPrice >= 0 ? parsedUnitPrice : 0;

  if (parsedQuantity === null || parsedQuantity <= 0) {
    stats.repairedQuantities += 1;
  }

  if (parsedUnitPrice === null || parsedUnitPrice < 0) {
    stats.repairedPrices += 1;
  }

  return {
    name,
    description,
    quantity,
    unit: normalizeCatalogUnit(
      getFirstString(value, ["unit", "unidad", "measure_unit", "measureUnit"]),
    ),
    unitPrice,
  } satisfies InvoiceScanItemDraft;
}

function buildWarnings(stats: InvoiceItemNormalizationStats) {
  const warnings: string[] = [];

  if (stats.omittedRows > 0) {
    warnings.push(`Se omitieron ${stats.omittedRows} filas vacías.`);
  }

  if (stats.repairedQuantities > 0) {
    warnings.push(
      `Se ajustaron ${stats.repairedQuantities} cantidades inválidas.`,
    );
  }

  if (stats.repairedPrices > 0) {
    warnings.push(`Se ajustaron ${stats.repairedPrices} precios inválidos.`);
  }

  return warnings;
}

function extractJsonObjectFromText(content: string) {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    throw new Error("OpenAI no devolvio contenido para analizar.");
  }

  try {
    return JSON.parse(trimmedContent) as unknown;
  } catch {
    const firstBraceIndex = trimmedContent.indexOf("{");
    const lastBraceIndex = trimmedContent.lastIndexOf("}");

    if (firstBraceIndex === -1 || lastBraceIndex === -1) {
      throw new Error("No se pudo interpretar la respuesta JSON del escaneo.");
    }

    return JSON.parse(
      trimmedContent.slice(firstBraceIndex, lastBraceIndex + 1),
    ) as unknown;
  }
}

export function normalizeInvoiceScanResult(
  input: unknown,
): NormalizedInvoiceScanResult {
  const source = isRecord(input) ? input : {};
  const stats: InvoiceItemNormalizationStats = {
    omittedRows: 0,
    repairedQuantities: 0,
    repairedPrices: 0,
  };

  const items = getCandidateItems(source)
    .map((item) => normalizeInvoiceItem(item, stats))
    .filter((item): item is InvoiceScanItemDraft => item !== null);

  return {
    supplierName: getFirstString(source, [
      "supplierName",
      "supplier_name",
      "supplier",
      "vendor",
      "vendor_name",
      "vendorName",
      "company",
      "company_name",
      "companyName",
      "issuer",
      "issuer_name",
      "issuerName",
      "seller",
      "business_name",
      "businessName",
      "razon_social",
      "razonSocial",
    ]),
    invoiceNumber: getFirstString(source, [
      "invoiceNumber",
      "invoice_number",
      "invoice_no",
      "invoiceNo",
      "number",
      "document_number",
      "documentNumber",
      "numero",
      "numero_factura",
      "numeroFactura",
      "bill_number",
      "billNumber",
      "comprobante",
      "receipt_number",
      "receiptNumber",
    ]),
    invoiceDate: getFirstString(source, [
      "invoiceDate",
      "invoice_date",
      "date",
      "issued_at",
      "issuedAt",
    ]),
    currency: getFirstString(source, [
      "currency",
      "currency_code",
      "currencyCode",
      "currency_symbol",
      "currencySymbol",
      "currency_name",
      "currencyName",
      "moneda",
    ]),
    notes: getFirstString(source, ["notes", "observations", "comments"]),
    items,
    warnings: buildWarnings(stats),
  };
}

export function sanitizeInvoiceReviewItemsForCatalog(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((value) => {
      if (!isRecord(value)) {
        return null;
      }

      const name = getFirstString(value, ["name"]);
      const price = parseDecimal(value.unitPrice ?? value.price);

      if (!name || price === null || price < 0) {
        return null;
      }

      return {
        name,
        description: getFirstString(value, ["description"]),
        unit: normalizeCatalogUnit(getFirstString(value, ["unit"])),
        price,
      } satisfies InvoiceCatalogDraft;
    })
    .filter((item): item is InvoiceCatalogDraft => item !== null);
}

export async function scanInvoiceWithAi({
  signedUrl,
  fileName,
}: ScanInvoiceWithAiInput) {
  const [{ getInvoiceScanModel, getOpenAIClient }] = await Promise.all([
    import("./openai"),
  ]);
  const client = getOpenAIClient();
  const model = getInvoiceScanModel();

  const completion = await client.chat.completions.create({
    model,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content:
          "Analiza la imagen de una factura o remito y devuelve solo un JSON válido. Incluye supplier_name, invoice_number, invoice_date, currency, notes e items. Prioriza extraer el nombre del proveedor, el número de factura y la moneda aunque también existan encabezados o sellos. Cada item debe tener name, description, quantity, unit y unit_price. Si un dato no se puede leer con certeza, usa null o una cadena vacía según corresponda, pero no inventes valores.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae los renglones editables de esta factura${fileName ? ` (${fileName})` : ""}. Devuelve solo JSON.`,
          },
          {
            type: "image_url",
            image_url: {
              url: signedUrl,
            },
          },
        ],
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJsonObjectFromText(content);

  return {
    model,
    rawResult: {
      model,
      content,
      parsed,
    },
    result: normalizeInvoiceScanResult(parsed),
  };
}
