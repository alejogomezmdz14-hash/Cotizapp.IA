import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const BOTTOM_NAV = new URL(
  "../components/layout/bottom-nav.tsx",
  import.meta.url,
);
const DASHBOARD_LAYOUT = new URL(
  "../app/(dashboard)/layout.tsx",
  import.meta.url,
);

test("la barra inferior reserva el safe-area una sola vez", async () => {
  const source = await readFile(BOTTOM_NAV, "utf8");

  assert.match(
    source,
    /height: `calc\(\$\{BOTTOM_NAV_HEIGHT_PX\}px \+ env\(safe-area-inset-bottom\)\)`/,
    "el <nav> es el que reserva el safe-area",
  );

  // Con box-sizing border-box, repetir el inset adentro de una altura fija le
  // come alto a los tabs: en un iPhone con indicador (34px) quedaban en 38px,
  // por debajo del minimo tactil de 44px, y sobraba barra vacia abajo.
  const ulBlock = source.slice(source.indexOf("<ul"), source.indexOf("</ul>"));
  assert.ok(
    !ulBlock.includes("safe-area-inset-bottom"),
    "el <ul> no debe repetir env(safe-area-inset-bottom)",
  );
  assert.ok(
    !ulBlock.includes("style="),
    "el <ul> no necesita estilos inline: la altura la reserva el <nav>",
  );
});

test("el contenido reserva la barra mas el boton central elevado", async () => {
  const nav = await readFile(BOTTOM_NAV, "utf8");
  const layout = await readFile(DASHBOARD_LAYOUT, "utf8");

  assert.match(
    nav,
    /"-mt-3 rounded-t-2xl/,
    "el boton central sobresale 0.75rem por encima del <nav>",
  );

  // 4.5rem de barra + 0.75rem que sobresale el boton = 5.25rem. Con 4.5rem el
  // bloque verde tapaba los ultimos 12px del contenido scrolleado.
  assert.match(
    layout,
    /pb-\[calc\(5\.25rem\+env\(safe-area-inset-bottom\)\)\]/,
    "el <main> reserva barra + boton elevado",
  );
  assert.ok(
    !layout.includes("pb-[calc(4.5rem+env(safe-area-inset-bottom))]"),
    "4.5rem no alcanza: el boton central tapa 12px de contenido",
  );

  assert.match(
    nav,
    /export const MOBILE_BOTTOM_NAV_OFFSET =\s*"calc\(5\.25rem \+ env\(safe-area-inset-bottom\)\)";/,
    "MOBILE_BOTTOM_NAV_OFFSET tiene que coincidir con el padding del <main>",
  );
});
