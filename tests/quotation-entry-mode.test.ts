import assert from "node:assert/strict";
import test from "node:test";

import type { QuotationEditorItem } from "../components/cotizacion/quotation-items-editor";
import {
  canRenderAsSingleAmount,
  explainSingleAmountBlockedReason,
  formatSingleAmountInput,
  getSingleAmountSaveState,
  planSingleAmountSync,
  resolveQuotationEntryMode,
} from "../lib/quotation-entry-mode";

function item(overrides: Partial<QuotationEditorItem> = {}): QuotationEditorItem {
  return {
    id: "item-1",
    source: "manual",
    catalogItemId: null,
    name: "destapado de cocina",
    description: "",
    quantity: 1,
    unit: "unidad",
    unitPrice: 45000,
    ...overrides,
  };
}

test("tabla de derivación del modo a partir del contenido", () => {
  const casos: Array<[string, QuotationEditorItem[], boolean]> = [
    ["draft vacío", [], true],
    ["un ítem simple", [item()], true],
    ["un ítem con cantidad 3", [item({ quantity: 3 })], false],
    ["un ítem con descripción", [item({ description: "Incluye materiales" })], false],
    ["dos ítems", [item(), item({ id: "item-2" })], false],
  ];

  for (const [caso, items, esperado] of casos) {
    assert.equal(canRenderAsSingleAmount(items), esperado, caso);
  }
});

test("una descripción que es solo espacios no fuerza el modo lista", () => {
  assert.equal(canRenderAsSingleAmount([item({ description: "   " })]), true);
});

test("un draft vacío arranca en monto único", () => {
  assert.equal(resolveQuotationEntryMode(null, []), "amount");
});

test("el override a lista manda aunque el contenido entre en monto único", () => {
  assert.equal(resolveQuotationEntryMode("items", []), "items");
  assert.equal(resolveQuotationEntryMode("items", [item()]), "items");
});

test("el override a monto único NO puede mentir sobre el contenido", () => {
  // Este es el caso del escaneo de factura: estabas en monto único, entraron 4
  // ítems, y la UI tiene que caer sola a lista sin código extra en el handler.
  const cuatroItems = [
    item({ id: "item-1" }),
    item({ id: "item-2" }),
    item({ id: "item-3" }),
    item({ id: "item-4" }),
  ];

  assert.equal(resolveQuotationEntryMode("amount", cuatroItems), "items");
});

test("reabrir un borrador de un ítem simple entra en monto único", () => {
  assert.equal(resolveQuotationEntryMode(null, [item()]), "amount");
});

test("reabrir un borrador de tres ítems entra en lista", () => {
  const tres = [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })];
  assert.equal(resolveQuotationEntryMode(null, tres), "items");
});

// --- planSingleAmountSync -------------------------------------------------

test("sin ítem y sin contenido no se crea nada", () => {
  // EL TEST QUE PROTEGE EL CARTEL DE BORRADOR. Si acá se creara un ítem vacío,
  // items.length > 0 desde el arranque haría aparecer "Tenés una cotización sin
  // guardar" apenas se abre la pantalla, sin haber tocado nada.
  assert.deepEqual(
    planSingleAmountSync({
      currentItem: null,
      name: "",
      amountText: "",
      nextItemId: 1,
    }),
    { type: "none" },
  );
});

test("un monto impronunciable tampoco crea un ítem", () => {
  assert.deepEqual(
    planSingleAmountSync({
      currentItem: null,
      name: "   ",
      amountText: "abc",
      nextItemId: 1,
    }),
    { type: "none" },
  );
});

test("la primera letra del nombre materializa el ítem", () => {
  const plan = planSingleAmountSync({
    currentItem: null,
    name: "d",
    amountText: "",
    nextItemId: 7,
  });

  assert.equal(plan.type, "create");
  assert.deepEqual(plan.type === "create" ? plan.item : null, {
    id: "item-7",
    source: "manual",
    catalogItemId: null,
    name: "d",
    description: "",
    quantity: 1,
    unit: "unidad",
    unitPrice: 0,
    nameFormat: "verbatim",
  });
});

test("escribir solo el monto también materializa el ítem", () => {
  const plan = planSingleAmountSync({
    currentItem: null,
    name: "",
    amountText: "45.000",
    nextItemId: 2,
  });

  assert.equal(plan.type, "create");
  assert.equal(plan.type === "create" ? plan.item.unitPrice : null, 45000);
  assert.equal(plan.type === "create" ? plan.item.name : null, "");
});

test("cambiar el nombre lo marca verbatim", () => {
  const plan = planSingleAmountSync({
    currentItem: item({ name: "destapado", unitPrice: 45000 }),
    name: "destapado de cocina",
    amountText: "45000",
    nextItemId: 9,
  });

  assert.deepEqual(plan, {
    type: "update",
    id: "item-1",
    updates: { name: "destapado de cocina", nameFormat: "verbatim" },
  });
});

test("reabrir un ítem title-caseado y editarlo lo pasa a verbatim", () => {
  // Sin esto, editar "Cemento Portland" y escribir "destapado de cocina" lo
  // guardaría como "Destapado De Cocina".
  const plan = planSingleAmountSync({
    currentItem: item({ name: "Cemento Portland", nameFormat: "entity", unitPrice: 100 }),
    name: "destapado de cocina",
    amountText: "100",
    nextItemId: 9,
  });

  assert.equal(plan.type, "update");
  assert.equal(
    plan.type === "update" ? plan.updates.nameFormat : null,
    "verbatim",
  );
});

test("cambiar solo el monto no toca el nombre ni su formato", () => {
  const plan = planSingleAmountSync({
    currentItem: item({ name: "Cemento Portland", nameFormat: "entity", unitPrice: 100 }),
    name: "Cemento Portland",
    amountText: "250",
    nextItemId: 9,
  });

  assert.deepEqual(plan, {
    type: "update",
    id: "item-1",
    updates: { unitPrice: 250 },
  });
});

test("si no cambió nada no se escribe al store", () => {
  assert.deepEqual(
    planSingleAmountSync({
      currentItem: item({ name: "destapado de cocina", unitPrice: 45000 }),
      name: "destapado de cocina",
      amountText: "45000",
      nextItemId: 9,
    }),
    { type: "none" },
  );
});

test("borrar el monto lo lleva a cero, no lo deja pegado", () => {
  const plan = planSingleAmountSync({
    currentItem: item({ unitPrice: 45000 }),
    name: "destapado de cocina",
    amountText: "",
    nextItemId: 9,
  });

  assert.deepEqual(plan, {
    type: "update",
    id: "item-1",
    updates: { unitPrice: 0 },
  });
});

test("vaciar los dos campos borra el ítem", () => {
  // Sin el remove, Guardar queda habilitado con un ítem fantasma sin nombre y
  // el server contesta "Cada ítem necesita un concepto".
  assert.deepEqual(
    planSingleAmountSync({
      currentItem: item(),
      name: "",
      amountText: "",
      nextItemId: 9,
    }),
    { type: "remove", id: "item-1" },
  );
});

test("vaciar uno solo de los dos campos no borra el ítem", () => {
  const soloNombre = planSingleAmountSync({
    currentItem: item(),
    name: "destapado de cocina",
    amountText: "",
    nextItemId: 9,
  });
  assert.equal(soloNombre.type, "update");

  const soloMonto = planSingleAmountSync({
    currentItem: item(),
    name: "",
    amountText: "45000",
    nextItemId: 9,
  });
  assert.equal(soloMonto.type, "update");
});

// --- getSingleAmountSaveState ---------------------------------------------

test("sin monto el guardado se bloquea por monto, no por el diálogo de $0", () => {
  const estado = getSingleAmountSaveState({
    name: "destapado de cocina",
    amountText: "",
  });

  assert.deepEqual(estado, {
    unitPrice: null,
    ready: false,
    blockedReason: "amount",
    isExplicitZero: false,
  });
});

test("sin nombre el guardado se bloquea por nombre", () => {
  const estado = getSingleAmountSaveState({ name: "   ", amountText: "45000" });

  assert.equal(estado.blockedReason, "name");
  assert.equal(estado.ready, false);
});

test("con los dos campos vacíos gana el nombre: es lo que se llena primero", () => {
  assert.equal(
    getSingleAmountSaveState({ name: "", amountText: "" }).blockedReason,
    "name",
  );
});

test("un cero tipeado a propósito sí deja guardar y marca isExplicitZero", () => {
  // Este es el caso para el que se escribió el diálogo "¿Va en $0?", y se
  // conserva intacto.
  const estado = getSingleAmountSaveState({
    name: "destapado de cocina",
    amountText: "0",
  });

  assert.deepEqual(estado, {
    unitPrice: 0,
    ready: true,
    blockedReason: null,
    isExplicitZero: true,
  });
});

test("el monto con separador de miles no se come tres ceros", () => {
  // "45.000" con Number.parseFloat da 45. Es exactamente donde el plomero
  // escribe el monto.
  assert.equal(
    getSingleAmountSaveState({ name: "trabajo", amountText: "45.000" }).unitPrice,
    45000,
  );
  assert.equal(
    getSingleAmountSaveState({ name: "trabajo", amountText: "1.250,50" }).unitPrice,
    1250.5,
  );
  assert.equal(
    getSingleAmountSaveState({ name: "trabajo", amountText: "45000" }).unitPrice,
    45000,
  );
});

test("cada motivo de bloqueo tiene copy en voseo", () => {
  assert.equal(explainSingleAmountBlockedReason("name"), "Escribí qué trabajo es");
  assert.equal(explainSingleAmountBlockedReason("amount"), "Poné cuánto cobrás");
});

// --- formatSingleAmountInput ----------------------------------------------

test("el monto guardado vuelve al campo sin separadores de miles", () => {
  // Con "45.000" en el campo, agregar un dígito daría "45.0001", que
  // parseDecimalInput lee como 45,0001.
  assert.equal(formatSingleAmountInput(45000), "45000");
  assert.equal(formatSingleAmountInput(1250.5), "1250.5");
});

test("un precio en cero o ausente muestra el campo vacío", () => {
  // Misma convención que la hoja manual del editor móvil. Si mostrara "0", el
  // gate lo leería como un cero tipeado a propósito.
  assert.equal(formatSingleAmountInput(0), "");
  assert.equal(formatSingleAmountInput(null), "");
});

test("el ítem creado en monto único es representable en monto único", () => {
  // Propiedad de cierre: lo que crea el modo no puede sacarlo del modo.
  const plan = planSingleAmountSync({
    currentItem: null,
    name: "destapado de cocina",
    amountText: "45.000",
    nextItemId: 1,
  });

  assert.equal(plan.type, "create");
  if (plan.type !== "create") {
    return;
  }

  assert.equal(canRenderAsSingleAmount([plan.item]), true);
  assert.equal(resolveQuotationEntryMode(null, [plan.item]), "amount");
});

test("se puede escribir un nombre de varias palabras", () => {
  // El campo está bindeado al store, así que si el reducer recortara el nombre
  // el espacio se borraría al tipearlo y sería imposible pasar de una palabra.
  const plan = planSingleAmountSync({
    currentItem: item({ name: "destapado", unitPrice: 45000 }),
    name: "destapado ",
    amountText: "45000",
    nextItemId: 9,
  });

  assert.deepEqual(plan, {
    type: "update",
    id: "item-1",
    updates: { name: "destapado ", nameFormat: "verbatim" },
  });
});

test("un nombre de solo espacios no cuenta como contenido", () => {
  assert.deepEqual(
    planSingleAmountSync({
      currentItem: item(),
      name: "   ",
      amountText: "",
      nextItemId: 9,
    }),
    { type: "remove", id: "item-1" },
  );

  assert.equal(
    getSingleAmountSaveState({ name: "   ", amountText: "45000" }).blockedReason,
    "name",
  );
});
