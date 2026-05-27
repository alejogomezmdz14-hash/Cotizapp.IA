import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { parseExpenseAmountInput } from "@/lib/expenses";
import type { ExpenseReceiptScanResult } from "@/types";

type ScanExpenseReceiptInput = {
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

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function extractJsonObjectFromText(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(content.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function normalizeCategory(value: unknown) {
  const category = getTrimmedString(value);

  if (!category) {
    return null;
  }

  const match = EXPENSE_CATEGORIES.find(
    (item) => item.toLowerCase() === category.toLowerCase(),
  );

  return match ?? "Otro";
}

export function normalizeExpenseReceiptScanResult(
  parsed: unknown,
): ExpenseReceiptScanResult {
  if (!isRecord(parsed)) {
    return {
      description: null,
      amount: null,
      currency: null,
      category: null,
    };
  }

  const amountRaw =
    parsed.amount ?? parsed.total ?? parsed.monto ?? parsed.importe;
  let amount: number | null = null;

  if (typeof amountRaw === "number" && Number.isFinite(amountRaw)) {
    amount = amountRaw >= 0 ? amountRaw : null;
  } else if (typeof amountRaw === "string") {
    amount = parseExpenseAmountInput(amountRaw);
  }

  return {
    description:
      getTrimmedString(parsed.description) ??
      getTrimmedString(parsed.descripcion) ??
      getTrimmedString(parsed.merchant) ??
      getTrimmedString(parsed.proveedor),
    amount,
    currency:
      getTrimmedString(parsed.currency)?.toUpperCase() ??
      getTrimmedString(parsed.moneda)?.toUpperCase() ??
      null,
    category: normalizeCategory(parsed.category ?? parsed.categoria),
  };
}

export async function scanExpenseReceiptWithAi({
  signedUrl,
  fileName,
}: ScanExpenseReceiptInput) {
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
        content: `Analiza la imagen de un recibo o ticket de compra y devuelve solo JSON con: description (texto corto del gasto), amount (número), currency (código ISO de 3 letras o null), category (una de: ${EXPENSE_CATEGORIES.join(", ")}). Si no puedes leer un dato con certeza, usa null. No inventes valores.`,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae descripción y monto de este recibo${fileName ? ` (${fileName})` : ""}. Devuelve solo JSON.`,
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

  return normalizeExpenseReceiptScanResult(parsed);
}
