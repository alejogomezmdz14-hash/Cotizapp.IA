import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { normalizeExpenseCurrency } from "@/lib/expense-currencies";
import {
  normalizeExpenseDateInput,
  parseExpenseAmountInput,
} from "@/lib/expenses";
import type { ExpenseReceiptScanResult } from "@/types";

const EXPENSE_RECEIPT_SCAN_MODEL = "gpt-4o";

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
      date: null,
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

  const dateRaw =
    getTrimmedString(parsed.date) ??
    getTrimmedString(parsed.fecha) ??
    getTrimmedString(parsed.issue_date);

  const currencyRaw =
    getTrimmedString(parsed.currency)?.toUpperCase() ??
    getTrimmedString(parsed.moneda)?.toUpperCase() ??
    null;

  return {
    description:
      getTrimmedString(parsed.description) ??
      getTrimmedString(parsed.descripcion) ??
      getTrimmedString(parsed.merchant) ??
      getTrimmedString(parsed.proveedor),
    amount,
    currency: currencyRaw ? normalizeExpenseCurrency(currencyRaw) : null,
    category: normalizeCategory(parsed.category ?? parsed.categoria),
    date: dateRaw ? normalizeExpenseDateInput(dateRaw) : null,
  };
}

export async function scanExpenseReceiptWithAi({
  signedUrl,
  fileName,
}: ScanExpenseReceiptInput) {
  const { getOpenAIClient } = await import("./openai");
  const client = getOpenAIClient();
  const model = EXPENSE_RECEIPT_SCAN_MODEL;

  const completion = await client.chat.completions.create({
    model,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `Analiza la imagen de un recibo o ticket de compra y devuelve solo JSON con: description (texto corto del gasto), amount (número), currency (código ISO de 3 letras o null), category (una de: ${EXPENSE_CATEGORIES.join(", ")}), date (YYYY-MM-DD o null). Si no podés leer un dato con certeza, usa null. No inventes valores.`,
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
