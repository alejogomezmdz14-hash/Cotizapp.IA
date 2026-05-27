import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import OpenAI from "openai";

const DEFAULT_INVOICE_SCAN_MODEL = "gpt-4o";
const OPENAI_API_KEY_ENV_NAME = "OPENAI_API_KEY";
const LOCAL_ENV_FILES = [".env.local", ".env"];

function unwrapEnvValue(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    const unwrappedValue = trimmedValue.slice(1, -1).trim();
    return unwrappedValue.length > 0 ? unwrappedValue : null;
  }

  return trimmedValue;
}

function readEnvValueFromFile(filePath: string, key: string) {
  if (!existsSync(filePath)) {
    return null;
  }

  const fileContents = readFileSync(filePath, "utf8");

  for (const line of fileContents.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(
      new RegExp(`^(?:export\\s+)?${key}\\s*=\\s*(.+)$`),
    );

    if (!match) {
      continue;
    }

    return unwrapEnvValue(match[1] ?? "");
  }

  return null;
}

export function getOpenAIApiKey() {
  const runtimeApiKey = process.env[OPENAI_API_KEY_ENV_NAME]?.trim();

  if (runtimeApiKey) {
    return runtimeApiKey;
  }

  for (const envFileName of LOCAL_ENV_FILES) {
    const envFilePath = join(process.cwd(), envFileName);
    const fileApiKey = readEnvValueFromFile(envFilePath, OPENAI_API_KEY_ENV_NAME);

    if (fileApiKey) {
      return fileApiKey;
    }
  }

  return null;
}

export function getOpenAIClient() {
  const apiKey = getOpenAIApiKey();

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
