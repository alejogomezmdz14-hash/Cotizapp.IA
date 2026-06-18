import assert from "node:assert/strict";
import test from "node:test";

import {
  mobileBarNavItems,
  mobileMoreNavItems,
} from "../components/layout/nav-items";

test("mobileBarNavItems arranca con Inicio y trae 5 destinos", () => {
  assert.equal(mobileBarNavItems[0]?.href, "/dashboard");
  assert.equal(mobileBarNavItems[0]?.label, "Inicio");
  assert.deepEqual(
    mobileBarNavItems.map((item) => item.href),
    ["/dashboard", "/clientes", "/cotizaciones", "/cotizaciones/nueva", "/gastos"],
  );
});

test("mobileMoreNavItems contiene los secundarios (Chat y Catálogo)", () => {
  assert.deepEqual(
    mobileMoreNavItems.map((item) => item.href),
    ["/chat", "/catalogo"],
  );
});
