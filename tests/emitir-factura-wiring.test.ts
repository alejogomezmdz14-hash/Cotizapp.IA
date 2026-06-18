import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("emitir-factura-button llama emitirFacturaAction y muestra el CAE", async () => {
  const source = await readFile(
    new URL("../components/cotizacion/emitir-factura-button.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /emitirFacturaAction/);
  assert.match(source, /Emitir factura/);
  assert.match(source, /CAE/);
});

test("el detalle gatea el botón por estado, país y perfil fiscal", async () => {
  const source = await readFile(
    new URL("../app/(dashboard)/cotizaciones/[id]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /EmitirFacturaButton/);
  assert.match(source, /isArgentina/);
  assert.match(source, /isFiscalProfileComplete/);
});
