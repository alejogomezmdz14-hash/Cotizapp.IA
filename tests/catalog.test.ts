import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CATALOG_UNIT,
  assertSingleCatalogMutation,
  buildCatalogSearchFilter,
  getCatalogDeleteFailureMessage,
  normalizeCatalogUnit,
  parseCatalogFormData,
} from "../lib/catalog";

test("parseCatalogFormData trims values and converts empty optionals to null", () => {
  const formData = new FormData();
  formData.set("name", "  arena fina  ");
  formData.set("description", "  Bolsa de 25 kg  ");
  formData.set("unit", "  bolsa ");
  formData.set("price", " 1299,50 ");
  formData.set("category", "  Agregados ");

  assert.deepEqual(parseCatalogFormData(formData), {
    name: "Arena Fina",
    description: "Bolsa de 25 kg",
    unit: "bolsa",
    price: 1299.5,
    category: "Agregados",
  });
});

test("parseCatalogFormData rejects missing names", () => {
  const formData = new FormData();
  formData.set("name", "   ");
  formData.set("price", "100");

  assert.throws(
    () => parseCatalogFormData(formData),
    /El nombre del ítem es obligatorio\./,
  );
});

test("parseCatalogFormData rejects invalid prices", () => {
  const formData = new FormData();
  formData.set("name", "Cemento");
  formData.set("price", "0");

  assert.throws(
    () => parseCatalogFormData(formData),
    /Ingresa un precio válido mayor a cero\./,
  );
});

test("parseCatalogFormData rejects malformed numeric strings", () => {
  for (const invalidPrice of ["12abc", "1,2,3", "10..5"]) {
    const formData = new FormData();
    formData.set("name", "Cemento");
    formData.set("price", invalidPrice);

    assert.throws(
      () => parseCatalogFormData(formData),
      /Ingresa un precio válido mayor a cero\./,
    );
  }
});

test("parseCatalogFormData defaults blank unit to the shared catalog unit", () => {
  const formData = new FormData();
  formData.set("name", "Servicio de colocacion");
  formData.set("unit", "   ");
  formData.set("price", "2500");

  assert.equal(parseCatalogFormData(formData).unit, DEFAULT_CATALOG_UNIT);
});

test("normalizeCatalogUnit keeps a consistent fallback for storage and display", () => {
  assert.equal(normalizeCatalogUnit(null), DEFAULT_CATALOG_UNIT);
  assert.equal(normalizeCatalogUnit("   "), DEFAULT_CATALOG_UNIT);
  assert.equal(normalizeCatalogUnit("  m2 "), "m2");
});

test("buildCatalogSearchFilter trims the search text and targets relevant fields", () => {
  assert.equal(
    buildCatalogSearchFilter("  cemento gris "),
    'name.ilike."%cemento gris%",description.ilike."%cemento gris%",category.ilike."%cemento gris%",unit.ilike."%cemento gris%"',
  );
});

test("buildCatalogSearchFilter returns null for empty searches", () => {
  assert.equal(buildCatalogSearchFilter("   "), null);
  assert.equal(buildCatalogSearchFilter(undefined), null);
});

test("buildCatalogSearchFilter escapes reserved PostgREST and LIKE characters", () => {
  assert.equal(
    buildCatalogSearchFilter('  Acme, 100%_*" \\\\  '),
    'name.ilike."%Acme, 100\\%\\_\\*\\" \\\\\\\\%",description.ilike."%Acme, 100\\%\\_\\*\\" \\\\\\\\%",category.ilike."%Acme, 100\\%\\_\\*\\" \\\\\\\\%",unit.ilike."%Acme, 100\\%\\_\\*\\" \\\\\\\\%"',
  );
});

test("assertSingleCatalogMutation accepts exactly one affected row", () => {
  assert.doesNotThrow(() => {
    assertSingleCatalogMutation([{ id: "catalog-1" }], "update");
  });
});

test("assertSingleCatalogMutation rejects update mutations with zero affected rows", () => {
  assert.throws(
    () => assertSingleCatalogMutation([], "update"),
    /El ítem no existe o no tenés permisos para actualizarlo\./,
  );
});

test("assertSingleCatalogMutation rejects delete mutations with zero affected rows", () => {
  assert.throws(
    () => assertSingleCatalogMutation([], "delete"),
    /El ítem no existe, no te pertenece o ya fue eliminado\./,
  );
});

test("getCatalogDeleteFailureMessage returns a clearer message for protected deletes", () => {
  assert.equal(
    getCatalogDeleteFailureMessage({ code: "23503" }),
    "No se puede eliminar el ítem porque está siendo usado en otras entidades.",
  );
});
