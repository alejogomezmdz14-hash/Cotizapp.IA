import assert from "node:assert/strict";
import test from "node:test";

import { bottomNavItems } from "../components/layout/nav-items";

test("bottomNavItems incluye Inicio como primer ítem", () => {
  assert.equal(bottomNavItems[0]?.href, "/dashboard");
  assert.equal(bottomNavItems[0]?.label, "Inicio");
});

test("bottomNavItems expone 7 destinos en la barra móvil", () => {
  assert.equal(bottomNavItems.length, 7);
  assert.deepEqual(
    bottomNavItems.map((item) => item.href),
    [
      "/dashboard",
      "/clientes",
      "/cotizaciones",
      "/cotizaciones/nueva",
      "/gastos",
      "/chat",
      "/catalogo",
    ],
  );
});
