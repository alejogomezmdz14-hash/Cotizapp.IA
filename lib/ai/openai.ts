import OpenAI from "openai";

const DEFAULT_INVOICE_SCAN_MODEL = "gpt-4o";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "Falta configurar OPENAI_API_KEY para escanear facturas con AI.",
    );
  }

  return new OpenAI({ apiKey });
}

export function getInvoiceScanModel() {
  return (
    process.env.OPENAI_INVOICE_SCAN_MODEL?.trim() ||
    process.env.OPENAI_VISION_MODEL?.trim() ||
    DEFAULT_INVOICE_SCAN_MODEL
  );
}
