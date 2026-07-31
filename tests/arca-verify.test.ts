import assert from "node:assert/strict";
import test from "node:test";

import { traducirErrorArca } from "../lib/arca/verify";

test("detecta que falta delegar el web service", () => {
  const r = traducirErrorArca(
    new Error("ns1:cms.cert.untrusted: El CEE no se encuentra autorizado a acceder al servicio wsfe"),
    "0001",
  );
  assert.equal(r.motivo, "sin-delegacion");
  assert.match(r.mensaje, /Administrador de Relaciones/i);
});

test("detecta que el punto de venta no existe o no es de Web Services", () => {
  const r = traducirErrorArca(
    new Error("El punto de venta referido no se encuentra habilitado para operar"),
    "0003",
  );
  assert.equal(r.motivo, "punto-de-venta");
  assert.match(r.mensaje, /0003/);
});

test("detecta un certificado vencido o rechazado", () => {
  const r = traducirErrorArca(
    new Error("Certificado expirado o no vigente"),
    "0001",
  );
  assert.equal(r.motivo, "certificado");
});

test("detecta que ARCA no responde", () => {
  assert.equal(traducirErrorArca(new Error("ETIMEDOUT"), "0001").motivo, "arca-caida");
  assert.equal(traducirErrorArca(new Error("socket hang up"), "0001").motivo, "arca-caida");
  assert.equal(traducirErrorArca(new Error("ECONNRESET"), "0001").motivo, "arca-caida");
});

test("un error desconocido no inventa un diagnostico", () => {
  const r = traducirErrorArca(new Error("algo rarisimo"), "0001");
  assert.equal(r.motivo, "desconocido");
  assert.doesNotMatch(r.mensaje, /Administrador de Relaciones/i);
});

test("nunca devuelve el texto crudo del error al usuario", () => {
  const r = traducirErrorArca(new Error("ns1:internal.stacktrace at com.afip.Foo:42"), "0001");
  assert.doesNotMatch(r.mensaje, /ns1:|stacktrace|com\.afip/);
});

test("tolera cosas que no son Error", () => {
  assert.equal(traducirErrorArca(null, "0001").motivo, "desconocido");
  assert.equal(traducirErrorArca("texto suelto", "0001").motivo, "desconocido");
});
