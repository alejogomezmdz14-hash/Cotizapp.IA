import assert from "node:assert/strict";
import test from "node:test";

import { describeError } from "../lib/log";

test("extrae solo name y message de un Error", () => {
  const error = new TypeError("algo salio mal");
  assert.deepEqual(describeError(error), {
    name: "TypeError",
    message: "algo salio mal",
  });
});

test("descarta las propiedades extra que adjunta la libreria soap", () => {
  const error = Object.assign(new Error("fallo WSFE"), {
    body: "<soap:Envelope>...secreto...</soap:Envelope>",
    response: { headers: { authorization: "Bearer TOKEN" } },
  });

  const described = describeError(error);

  assert.deepEqual(Object.keys(described).sort(), ["message", "name"]);
  assert.equal(JSON.stringify(described).includes("secreto"), false);
  assert.equal(JSON.stringify(described).includes("TOKEN"), false);
});

test("no explota con valores que no son Error", () => {
  assert.deepEqual(describeError("un string suelto"), {
    name: "UnknownError",
    message: "un string suelto",
  });
  assert.deepEqual(describeError(null), {
    name: "UnknownError",
    message: "unknown",
  });
});

test("no filtra el contenido de un objeto arbitrario", () => {
  const described = describeError({ cert: "-----BEGIN RSA PRIVATE KEY-----" });
  assert.equal(described.message.includes("PRIVATE KEY"), false);
});
