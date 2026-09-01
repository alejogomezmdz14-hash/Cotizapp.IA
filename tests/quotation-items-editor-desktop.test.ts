import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Coherencia entre el editor de escritorio y el modo monto único del celular.
 *
 * `nameFormat: "verbatim"` marca que un nombre de ítem NO se debe title-casear
 * (lo escribe el modo monto único, donde el nombre es la descripción del
 * trabajo y va así al PDF). El editor de escritorio no tiene ningún indicio
 * visual de ese flag — para quien edita ahí, el nombre siempre esperó
 * title-case, como toda la vida.
 *
 * Sin este test, el store (merge parcial en updateItem) deja sobrevivir
 * `nameFormat: "verbatim"` a una edición hecha desde escritorio: el usuario
 * ensancha la ventana, corrige un nombre que vino "verbatim" del celular, y el
 * nombre nuevo se guarda literal sin que nada en la UI lo avise.
 */
async function leerItemsEditor() {
  return readFile(
    new URL("../components/cotizacion/quotation-items-editor.tsx", import.meta.url),
    "utf8",
  );
}

test("editar el concepto desde escritorio resetea nameFormat a entity", async () => {
  const source = await leerItemsEditor();

  const campoConcepto = source.slice(
    source.indexOf("<ConceptFieldWithVoice"),
    source.indexOf("<ConceptFieldWithVoice") + 900,
  );

  assert.ok(
    campoConcepto.includes('onUpdateItem(item.id, { name, nameFormat: "entity" })'),
    'editar el nombre desde escritorio no vuelve a marcar nameFormat: "entity" — un ítem "verbatim" del celular quedaría literal para siempre',
  );
});
