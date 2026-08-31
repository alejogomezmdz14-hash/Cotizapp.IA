/**
 * Parser PURO (sin imports de server) para números tipeados a mano, aceptando
 * formato es-AR ("1.250,50") y en-US ("1250.50"). Devuelve `null` cuando el
 * texto no contiene un número.
 *
 * Existe porque los inputs decimales NO pueden ser type="number": con el
 * teclado latino el usuario escribe una coma, el navegador considera el valor
 * inválido y entrega string vacío, así que el dato se pierde antes de que
 * cualquier parser lo vea. Los inputs van type="text" inputMode="decimal" y el
 * texto crudo se normaliza acá.
 */
export function parseDecimalInput(value: string) {
  const compactValue = value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!compactValue || !/\d/.test(compactValue)) {
    return null;
  }

  const isNegative = compactValue.startsWith("-");
  const unsignedValue = isNegative ? compactValue.slice(1) : compactValue;

  // Separadores de miles sin parte decimal: "45.000" es cuarenta y cinco mil,
  // no 45. Sin este caso Number("45.000") da 45 y el usuario registra un monto
  // mil veces menor sin enterarse.
  if (/^\d{1,3}(\.\d{3})+$/.test(unsignedValue)) {
    const parsedThousands = Number(unsignedValue.replace(/\./g, ""));
    return isNegative ? -parsedThousands : parsedThousands;
  }

  if (/^\d{1,3}(,\d{3})+$/.test(unsignedValue)) {
    const parsedThousands = Number(unsignedValue.replace(/,/g, ""));
    return isNegative ? -parsedThousands : parsedThousands;
  }

  const lastCommaIndex = unsignedValue.lastIndexOf(",");
  const lastDotIndex = unsignedValue.lastIndexOf(".");

  let normalized = unsignedValue;

  if (lastCommaIndex !== -1 && lastDotIndex !== -1) {
    // El separador decimal es el que aparece más a la derecha; el otro son
    // miles ("1.250,50" en es-AR, "1,250.50" en en-US).
    const decimalSeparator = lastCommaIndex > lastDotIndex ? "," : ".";
    const thousandsPattern = decimalSeparator === "," ? /\./g : /,/g;
    normalized = unsignedValue
      .replace(thousandsPattern, "")
      .replace(decimalSeparator, ".");
  } else if (lastCommaIndex !== -1) {
    // Una sola coma: es decimal si deja como mucho dos dígitos a la derecha
    // ("1,5"), y miles si no ("1,250").
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

/** Igual que `parseDecimalInput` pero con un default para campos que no pueden quedar vacíos. */
export function parseDecimalInputOr(value: string, fallback: number) {
  const parsed = parseDecimalInput(value);
  return parsed === null ? fallback : parsed;
}
