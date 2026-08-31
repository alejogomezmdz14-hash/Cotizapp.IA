import { parseDecimalInput } from "@/lib/decimal-input";

// Alias histórico: la lógica de parseo vive en lib/decimal-input.ts, que la
// comparte con el resto de los campos decimales (precios, cantidades, IVA).
// Se mantiene el nombre para no tocar sus llamadores ni sus tests.
export function parseExpenseAmountInput(value: string) {
  return parseDecimalInput(value);
}
