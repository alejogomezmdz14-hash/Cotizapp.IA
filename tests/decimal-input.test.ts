import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseDecimalInput } from "../lib/decimal-input";
import { parseExpenseAmountInput } from "../lib/expense-amount";

test("parseDecimalInput entiende el formato es-AR", () => {
  assert.equal(parseDecimalInput("1.250,50"), 1250.5);
  assert.equal(parseDecimalInput("1,5"), 1.5);
  assert.equal(parseDecimalInput("0,99"), 0.99);
  assert.equal(parseDecimalInput("1.000.000"), 1000000);
});

test("parseDecimalInput entiende el formato en-US", () => {
  assert.equal(parseDecimalInput("1250.50"), 1250.5);
  assert.equal(parseDecimalInput("1,250.50"), 1250.5);
  assert.equal(parseDecimalInput("1250"), 1250);
});

test("parseDecimalInput tolera espacios y símbolos de moneda", () => {
  assert.equal(parseDecimalInput("  $ 1.250,50 "), 1250.5);
  assert.equal(parseDecimalInput("ARS 45.000"), 45000);
});

test("parseDecimalInput devuelve null cuando no hay un número", () => {
  assert.equal(parseDecimalInput(""), null);
  assert.equal(parseDecimalInput("   "), null);
  assert.equal(parseDecimalInput("abc"), null);
  assert.equal(parseDecimalInput(","), null);
});

test("parseDecimalInput conserva el signo negativo", () => {
  assert.equal(parseDecimalInput("-1.250,50"), -1250.5);
});

test("parseExpenseAmountInput delega en parseDecimalInput", () => {
  // Mismo comportamiento: el de gastos quedó como alias para no romper sus
  // llamadores ni sus tests, pero la lógica vive en un solo lugar.
  for (const value of ["1.250,50", "1250.50", "1,5", "", "abc", "-3,25"]) {
    assert.deepEqual(parseExpenseAmountInput(value), parseDecimalInput(value));
  }
});

test("ningún campo decimal de una pantalla móvil usa type=number", async () => {
  // Con type="number" el navegador considera "1.250,50" inválido y entrega
  // string vacío: el valor se pierde antes de que cualquier parser lo vea. Con
  // el teclado latino, escribir la coma vacía el campo.
  //
  // Solo se listan las pantallas que se usan desde el celular.
  // quotation-items-editor.tsx y el <form> de quotation-form.tsx quedan afuera
  // a propósito: viven dentro de un contenedor `hidden xl:block`, o sea que son
  // exclusivos de escritorio, donde se tipea con teclado físico y punto. El
  // editor móvil real es quotation-editor-mobile.tsx, que ya usa type="text".
  const pantallasMoviles = [
    "components/catalogo/catalog-item-form.tsx",
    "components/gastos/expense-form-sheet.tsx",
    "components/chat/cotizacion-resumen.tsx",
    "components/chat/catalog-picker.tsx",
    "components/cotizacion/quotation-editor-mobile.tsx",
  ];

  for (const archivo of pantallasMoviles) {
    const source = await readFile(new URL(`../${archivo}`, import.meta.url), "utf8");
    assert.ok(
      !source.includes('type="number"'),
      `${archivo} todavía tiene un input type="number"`,
    );
  }
});
