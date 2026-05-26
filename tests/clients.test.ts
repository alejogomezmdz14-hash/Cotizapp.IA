import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSingleClientMutation,
  buildClientSearchFilter,
  getClientDeleteFailureMessage,
  parseClientFormData,
} from "../lib/clients";

test("parseClientFormData trims values and converts empty optionals to null", () => {
  const formData = new FormData();
  formData.set("name", "  Ferreteria Central  ");
  formData.set("email", "  ventas@ferre.com ");
  formData.set("phone", "   ");
  formData.set("address", "  San Martin 123  ");

  assert.deepEqual(parseClientFormData(formData), {
    name: "Ferreteria Central",
    email: "ventas@ferre.com",
    phone: null,
    address: "San Martin 123",
  });
});

test("parseClientFormData rejects missing names", () => {
  const formData = new FormData();
  formData.set("name", "   ");

  assert.throws(
    () => parseClientFormData(formData),
    /El nombre del cliente es obligatorio\./,
  );
});

test("buildClientSearchFilter trims the search text and targets name, email and phone", () => {
  assert.equal(
    buildClientSearchFilter("  juan perez "),
    'name.ilike."%juan perez%",email.ilike."%juan perez%",phone.ilike."%juan perez%"',
  );
});

test("buildClientSearchFilter returns null for empty searches", () => {
  assert.equal(buildClientSearchFilter("   "), null);
  assert.equal(buildClientSearchFilter(undefined), null);
});

test("buildClientSearchFilter escapes reserved PostgREST and LIKE characters", () => {
  assert.equal(
    buildClientSearchFilter('  Acme, 100%_*" \\\\  '),
    'name.ilike."%Acme, 100\\%\\_\\*\\" \\\\\\\\%",email.ilike."%Acme, 100\\%\\_\\*\\" \\\\\\\\%",phone.ilike."%Acme, 100\\%\\_\\*\\" \\\\\\\\%"',
  );
});

test("assertSingleClientMutation accepts exactly one affected row", () => {
  assert.doesNotThrow(() => {
    assertSingleClientMutation([{ id: "client-1" }], "update");
  });
});

test("assertSingleClientMutation rejects update mutations with zero affected rows", () => {
  assert.throws(
    () => assertSingleClientMutation([], "update"),
    /El cliente no existe o no tenes permisos para actualizarlo\./,
  );
});

test("assertSingleClientMutation rejects delete mutations with zero affected rows", () => {
  assert.throws(
    () => assertSingleClientMutation([], "delete"),
    /El cliente no existe, no te pertenece o ya fue eliminado\./,
  );
});

test("getClientDeleteFailureMessage returns a clearer message for protected deletes", () => {
  assert.equal(
    getClientDeleteFailureMessage({ code: "23503" }),
    "No se puede eliminar el cliente porque tiene cotizaciones u otros datos asociados.",
  );
});
