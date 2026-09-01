import assert from "node:assert/strict";
import test from "node:test";

import {
  nextSingleAmountInput,
  resolveSingleAmountText,
} from "../lib/quotation-entry-mode";

test("sin estado local todavía, se muestra el monto guardado", () => {
  assert.equal(resolveSingleAmountText(null, "item-1", 45000), "45000");
  assert.equal(resolveSingleAmountText(null, "item-1", null), "");
});

test("con el mismo id, se muestra el texto crudo tipeado", () => {
  // "45." es un estado intermedio que no sobrevive un round-trip por number.
  const amountInput = { itemId: "item-1", text: "45." };
  assert.equal(resolveSingleAmountText(amountInput, "item-1", 45), "45.");
});

test("con un id distinto, el texto local se ignora", () => {
  // Cambió la identidad del ítem (se guardó, se escaneó una factura): el texto
  // viejo no le pertenece más a este ítem.
  const amountInput = { itemId: "item-viejo", text: "999" };
  assert.equal(resolveSingleAmountText(amountInput, "item-nuevo", 10), "10");
});

test("EL BUG: tras Empezar de nuevo, el monto descartado no puede reaparecer", () => {
  // Reproduce paso a paso el escenario encontrado en revisión: resetDraft()
  // devuelve nextItemId a 1, así que el primer ítem después del reset recicla
  // el id "item-1" — el mismo id que tenía la cotización descartada.
  //
  // 1) Cotización A: el usuario tipeó "50000" en el campo de monto.
  let amountInput = nextSingleAmountInput("item-1", "50000");
  assert.equal(resolveSingleAmountText(amountInput, "item-1", 50000), "50000");

  // 2) "Empezar de nuevo": el store vacía items, pero el estado local del
  //    campo de monto no se toca todavía (nadie escribió nada nuevo).
  //    El ítem ya no existe: singleItemId es null.
  assert.equal(resolveSingleAmountText(amountInput, null, null), "");

  // 3) El usuario escribe el nombre del trabajo nuevo. Esto crea un ítem que
  //    RECICLA el id "item-1". El fix exige reescribir amountInput SIEMPRE,
  //    incluso cuando el tecleo vino del campo del NOMBRE, con el texto que
  //    ya se estaba mostrando (que en este punto es "").
  amountInput = nextSingleAmountInput("item-1", "");

  // 4) El campo de monto tiene que seguir vacío: NO puede reaparecer "50000".
  assert.equal(
    resolveSingleAmountText(amountInput, "item-1", 0),
    "",
    "el monto de la cotización descartada revivió en la cotización nueva",
  );
});

test("reescribir siempre no rompe el caso normal de tipear el monto", () => {
  const amountInput = nextSingleAmountInput("item-1", "45.000");
  assert.equal(resolveSingleAmountText(amountInput, "item-1", null), "45.000");
});
