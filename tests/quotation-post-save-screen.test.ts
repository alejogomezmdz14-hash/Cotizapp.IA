import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * La pantalla post-guardado era un early return sin ninguna rama móvil: se
 * servía el panel de escritorio tal cual, con un párrafo de jerga y tres
 * botones que empujaban "Enviar por WhatsApp" fuera del primer pliegue.
 *
 * Como el repo no tiene DOM en los tests, se protege la estructura leyendo el
 * source — mismo patrón que tests/decimal-input.test.ts.
 */
async function leerForm() {
  return readFile(
    new URL("../components/cotizacion/quotation-form.tsx", import.meta.url),
    "utf8",
  );
}

function bloquePostGuardado(source: string) {
  const inicio = source.indexOf("if (initialDraft && !initialEditorState) {");
  const fin = source.indexOf("{trialBlocked ? (");

  assert.ok(inicio >= 0, "no se encontró la pantalla post-guardado");
  assert.ok(fin > inicio, "no se encontró el final de la pantalla post-guardado");

  return source.slice(inicio, fin);
}

test("la pantalla post-guardado tiene una rama móvil propia", async () => {
  const bloque = bloquePostGuardado(await leerForm());

  assert.ok(
    bloque.includes("xl:hidden"),
    "la pantalla post-guardado sigue siendo solo el panel de escritorio",
  );
  assert.ok(
    bloque.includes("hidden") && bloque.includes("xl:block"),
    "el panel de escritorio no está declarado como de escritorio",
  );
});

test("en móvil se muestra el número de cotización arriba de todo", async () => {
  const bloque = bloquePostGuardado(await leerForm());
  const movil = bloque.slice(0, bloque.indexOf("<QuotationShareActions"));

  assert.ok(movil.includes("{savedNumber}"), "no se muestra el número");
  assert.ok(
    movil.includes("Cotización guardada"),
    "no se dice que quedó guardada",
  );
});

test("se borró el párrafo de jerga", async () => {
  const bloque = bloquePostGuardado(await leerForm());

  for (const jerga of [
    "sin duplicar información",
    "volver al historial",
    "regenerar el PDF",
    "solo lectura",
  ]) {
    assert.equal(
      bloque.includes(jerga),
      false,
      `la pantalla post-guardado todavía dice "${jerga}"`,
    );
  }
});

test("las acciones secundarias de PDF no se duplican en el celular", async () => {
  // quotation-more-menu.tsx implementa literalmente las mismas acciones que la
  // fila de botones de quotation-share-actions.tsx.
  const bloque = bloquePostGuardado(await leerForm());

  assert.ok(
    bloque.includes('secondaryPdfActions="desktopOnly"'),
    "los botones secundarios de PDF siguen apareciendo en el celular",
  );
  assert.ok(
    bloque.includes("<QuotationMoreMenu"),
    "no hay menú de más opciones en el celular",
  );
});

test("el menú de más opciones dice qué es, no es solo un icono", async () => {
  const bloque = bloquePostGuardado(await leerForm());

  assert.ok(
    bloque.includes('triggerLabel="Más opciones"'),
    "el menú del celular quedó como un «⋯» sin texto",
  );
});

test("QuotationShareActions se monta una sola vez", async () => {
  // Dos montajes serían dos estados independientes y dos botones "Enviar por
  // WhatsApp" en el DOM.
  const bloque = bloquePostGuardado(await leerForm());
  const montajes = bloque.split("<QuotationShareActions").length - 1;

  assert.equal(montajes, 1, `QuotationShareActions se monta ${montajes} veces`);
});

test("la variante muerta listPrimary ya no existe", async () => {
  const share = await readFile(
    new URL("../components/cotizacion/quotation-share-actions.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(
    share.includes("listPrimary"),
    false,
    "volvió la variante listPrimary, que ningún componente usaba",
  );
});

test("el flujo de compartir usa el orquestador con el orden correcto", async () => {
  const share = await readFile(
    new URL("../components/cotizacion/quotation-share-actions.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(
    share.includes("runNativeQuotationShare("),
    "el camino nativo no usa el orquestador",
  );
  assert.ok(
    share.includes("retryQuotationShare("),
    "el segundo toque no usa el orquestador",
  );
  assert.ok(
    share.includes("prepareQuotationWhatsappShareAction("),
    "sigue marcando como enviada antes de compartir",
  );
});

test("el fallback de wa.me ofrece deshacer", async () => {
  const share = await readFile(
    new URL("../components/cotizacion/quotation-share-actions.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(share.includes("WHATSAPP_FALLBACK_MESSAGE"), "falta el copy honesto");
  assert.ok(share.includes("No la mandé"), "falta la acción de deshacer");
  assert.ok(share.includes("canUndoQuotationShare("), "el deshacer no está condicionado");
});
