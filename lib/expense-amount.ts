// Helper PURO (sin imports de server): parsea montos tipeados por el usuario
// aceptando formato es-AR ("1.250,50") y en-US ("1250.50"). Vive separado de
// lib/expenses.ts para poder importarse desde componentes cliente sin arrastrar
// el cliente de Supabase (server-only).
export function parseExpenseAmountInput(value: string) {
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

  let normalized = unsignedValue;

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const thousandsPattern = decimalSeparator === "," ? /\./g : /,/g;
    normalized = unsignedValue
      .replace(thousandsPattern, "")
      .replace(decimalSeparator, ".");
  } else if (lastCommaIndex !== -1) {
    const parts = unsignedValue.split(",");
    normalized =
      parts.length === 2 && parts[1].length <= 2
        ? `${parts[0]}.${parts[1]}`
        : unsignedValue.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return isNegative ? -parsed : parsed;
}
