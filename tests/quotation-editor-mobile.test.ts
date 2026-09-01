import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Tests de estructura sobre el source del editor móvil.
 *
 * El repo no tiene DOM en los tests (tsx --test, sin jsdom), así que la lógica
 * pura vive en lib/ y se testea directo — ver tests/quotation-entry-mode.test.ts
 * — y acá se protege el CABLEADO, que es donde se rompería en silencio.
 * Mismo patrón que tests/decimal-input.test.ts y tests/dropdown-touch-target.test.ts.
 */
const SOURCE = new URL(
  "../components/cotizacion/quotation-editor-mobile.tsx",
  import.meta.url,
);

async function leerSource() {
  return readFile(SOURCE, "utf8");
}

test("el editor móvil ya no tiene su propio parser de decimales roto", async () => {
  // parseNumeric hacía Number.parseFloat(value.replace(",", ".")), así que
  // "45.000" daba 45 — justo donde el plomero escribe el monto.
  const source = await leerSource();

  assert.equal(
    source.includes("function parseNumeric"),
    false,
    "volvió parseNumeric al editor móvil",
  );
  assert.equal(
    source.includes('replace(",", ".")'),
    false,
    "volvió el replace de coma por punto",
  );
});

test("el editor móvil usa el parser de decimales del repo", async () => {
  const source = await leerSource();

  assert.ok(
    source.includes('from "@/lib/decimal-input"'),
    "el editor móvil no importa parseDecimalInput",
  );
  assert.ok(
    source.includes("parseDecimalInput("),
    "el editor móvil no llama a parseDecimalInput",
  );
});

test("los campos de monto único declaran teclado decimal y no type=number", async () => {
  // Con type="number" el navegador considera "1.250,50" inválido y entrega
  // string vacío: con el teclado latino, escribir la coma vacía el campo.
  const source = await leerSource();

  assert.equal(source.includes('type="number"'), false);

  const campoMonto = source.slice(source.indexOf('id="mobile-single-amount"'));
  assert.ok(
    campoMonto.slice(0, 400).includes('inputMode="decimal"'),
    "el campo de monto único no declara inputMode decimal",
  );
});

test("el modo se deriva del contenido, no de un useState local", async () => {
  // hydrateFromEditor corre en un useEffect DESPUÉS del montaje: en el primer
  // render items es [], así que un useState(() => infer(items)) congelaría
  // "monto único" y después llegarían los ítems con la UI equivocada.
  const source = await leerSource();

  assert.ok(
    source.includes("resolveQuotationEntryMode(draft.entryModeOverride, items)"),
    "el modo no se deriva con resolveQuotationEntryMode",
  );
  assert.equal(
    /useState[^\n]*entryMode/i.test(source),
    false,
    "el modo quedó en un useState local",
  );
});

test("el ítem se materializa al tipear, no al guardar", async () => {
  // canSave viene del padre y exige items.length > 0. Si el ítem se creara
  // recién en el submit, el botón Guardar quedaría gris mientras se escribe.
  const source = await leerSource();

  const sync = source.slice(
    source.indexOf("function syncSingleAmount"),
    source.indexOf("function switchToItemsMode"),
  );

  assert.ok(sync.length > 0, "no existe syncSingleAmount");
  assert.ok(sync.includes("planSingleAmountSync("), "no usa el reducer puro");
  assert.ok(sync.includes("addItem("), "no crea el ítem al tipear");
  assert.ok(sync.includes("updateItem("), "no actualiza el ítem al tipear");
  assert.ok(sync.includes("removeItem("), "no borra el ítem al vaciar los campos");
});

test("el gate de monto único está en el disabled del botón Guardar", async () => {
  // Es lo que evita que "sin monto" caiga en el diálogo "¿Va en $0?".
  const source = await leerSource();

  const barra = source.slice(source.indexOf("{/* Sticky guardar */}"));

  assert.ok(
    barra.includes("!singleAmountReady"),
    "el botón Guardar no considera el gate de monto único",
  );
  assert.ok(
    barra.includes("<ActionHint"),
    "la barra fija perdió el ActionHint que explica qué falta",
  );
});

test("los dos campos de monto único están cableados al mismo handler", async () => {
  const source = await leerSource();

  assert.ok(source.includes("syncSingleAmount({ name: event.target.value })"));
  assert.ok(source.includes("syncSingleAmount({ amountText: event.target.value })"));
});

test("se puede ir y volver entre monto único y lista", async () => {
  const source = await leerSource();

  assert.ok(source.includes("Detallar por ítems"), "falta el paso a lista");
  assert.ok(source.includes("Volver a monto único"), "falta la vuelta a monto único");
  assert.ok(
    source.includes("canOfferSingleAmount ? ("),
    "la vuelta a monto único no está condicionada al contenido",
  );
});

test("todo lo que se toca en monto único cumple el mínimo táctil de 44px", async () => {
  const source = await leerSource();

  const bloque = source.slice(
    source.indexOf('<Section title="El trabajo">'),
    source.indexOf('<Section title="Ítems">'),
  );

  assert.ok(bloque.length > 0, "no se encontró el bloque de monto único");

  const alturas = bloque.match(/min-h-\d+/g) ?? [];
  assert.ok(alturas.length >= 3, "faltan alturas mínimas declaradas");

  for (const altura of alturas) {
    const rem = Number(altura.replace("min-h-", "")) / 4;
    assert.ok(rem >= 2.75, `${altura} es menor a 44px`);
  }
});

test("el copy del modo monto único está en voseo rioplatense", async () => {
  const source = await leerSource();

  for (const copy of ["¿Qué trabajo es?", "¿Cuánto cobrás?"]) {
    assert.ok(source.includes(copy), `falta el copy "${copy}"`);
  }

  assert.equal(
    source.includes("presupuesto"),
    false,
    'en Cotizapp nunca se dice "presupuesto"',
  );
});

test("el texto local del monto se invalida ante cualquier cambio de modo", async () => {
  // No solo el manual (switchToItemsMode): también las transiciones
  // automáticas (escaneo que suma ítems, o volver a monto único al quitar
  // ítems) tienen que invalidar el texto viejo. Si no, el campo podía mostrar
  // un monto que ya no coincidía con lo guardado.
  const source = await leerSource();

  assert.ok(
    /useEffect\(\(\) => \{\s*setAmountInput\(null\);/.test(source),
    "no hay un efecto que invalide el monto local ante cambios de modo",
  );
  assert.ok(
    source.includes("}, [entryMode]);"),
    "el efecto de invalidación no está atado a entryMode",
  );
});

test("un ítem sin nombre no puede colarse por el gate al pasar a lista", async () => {
  // El modo monto único puede materializar un ítem con name: "" (si se tipeó
  // primero el monto). Antes, en modo lista eso era imposible porque la hoja
  // manual, el catálogo y el escaneo siempre traen nombre.
  const source = await leerSource();

  assert.ok(
    source.includes("namelessItemCount"),
    "no existe el chequeo de ítems sin nombre en modo lista",
  );

  const barra = source.slice(source.indexOf("{/* Sticky guardar */}"));
  assert.ok(
    barra.includes("namelessItemCount > 0"),
    "el botón Guardar no bloquea ítems sin nombre",
  );
});
