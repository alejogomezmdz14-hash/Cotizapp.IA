import assert from "node:assert/strict";
import test from "node:test";

import {
  inferQuotationItemNameFormat,
  resolveQuotationItemName,
} from "../lib/quotation-item-name";

test("verbatim respeta lo que escribió el usuario y solo colapsa espacios", () => {
  // En monto único este texto ES la cotización: es lo único que el cliente lee
  // en el PDF. "Destapado De Cocina" se ve como un error de la app.
  assert.equal(
    resolveQuotationItemName("  destapado de cocina ", "verbatim"),
    "destapado de cocina",
  );
  assert.equal(
    resolveQuotationItemName("cambio   de   termotanque", "verbatim"),
    "cambio de termotanque",
  );
});

test("sin nameFormat se conserva el title-case histórico", () => {
  // Retrocompatibilidad explícita: los payloads que ya existen no traen el
  // campo, y tienen que guardarse exactamente igual que antes.
  assert.equal(
    resolveQuotationItemName("  cemento portland  ", undefined),
    "Cemento Portland",
  );
  assert.equal(resolveQuotationItemName("cemento portland", "entity"), "Cemento Portland");
});

test("cualquier valor raro de nameFormat cae al comportamiento histórico", () => {
  // El campo viaja en un payload JSON del cliente: no se puede confiar en él.
  for (const raro of [null, 0, 1, true, "VERBATIM", "otra-cosa", {}, []]) {
    assert.equal(
      resolveQuotationItemName("cemento portland", raro),
      "Cemento Portland",
      `nameFormat=${JSON.stringify(raro)} no debería activar verbatim`,
    );
  }
});

test("un nombre ya normalizado se infiere como entity", () => {
  assert.equal(inferQuotationItemNameFormat("Cemento Portland"), "entity");
});

test("un nombre con minúsculas internas se infiere como verbatim", () => {
  assert.equal(inferQuotationItemNameFormat("Destapado de cocina"), "verbatim");
  assert.equal(inferQuotationItemNameFormat("destapado de cocina"), "verbatim");
});

test("los acrónimos no se confunden con verbatim", () => {
  // normalizeEntityName respeta los tokens que ya vienen en mayúscula, así que
  // "Caño PVC" es su propia forma normalizada.
  assert.equal(inferQuotationItemNameFormat("Caño PVC"), "entity");
  assert.equal(inferQuotationItemNameFormat("Membrana SBS"), "entity");
});

test("el round-trip es estable: lo inferido reproduce el nombre guardado", () => {
  // Esta es la propiedad que evita la regresión: guardar → reabrir → guardar
  // no puede cambiar el nombre.
  const guardados = [
    "destapado de cocina",
    "Cemento Portland",
    "Caño PVC",
    "Reparación de bomba",
    "instalación completa de agua fría y caliente",
  ];

  for (const guardado of guardados) {
    const formato = inferQuotationItemNameFormat(guardado);
    assert.equal(
      resolveQuotationItemName(guardado, formato),
      guardado,
      `"${guardado}" cambió al reabrir y volver a guardar`,
    );
  }
});
