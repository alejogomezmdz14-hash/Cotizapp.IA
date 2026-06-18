import assert from "node:assert/strict";
import test from "node:test";

import {
  FISCAL_CREDENTIAL_MAX_BYTES,
  assertValidFiscalCredential,
} from "../lib/uploads";

function fakeFile(name: string, size: number) {
  return { name, size } as File;
}

test("acepta .crt para kind cert y .key para kind key dentro del límite", () => {
  assert.doesNotThrow(() =>
    assertValidFiscalCredential(fakeFile("cert.crt", 2000), "cert"),
  );
  assert.doesNotThrow(() =>
    assertValidFiscalCredential(fakeFile("private.key", 2000), "key"),
  );
});

test("rechaza extensión que no corresponde al kind", () => {
  assert.throws(() =>
    assertValidFiscalCredential(fakeFile("cert.key", 2000), "cert"),
  );
  assert.throws(() =>
    assertValidFiscalCredential(fakeFile("private.crt", 2000), "key"),
  );
});

test("rechaza archivos por encima del límite de tamaño", () => {
  assert.throws(() =>
    assertValidFiscalCredential(
      fakeFile("cert.crt", FISCAL_CREDENTIAL_MAX_BYTES + 1),
      "cert",
    ),
  );
});
