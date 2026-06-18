import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("MobileMoreSheet linkea Ajustes, Mi empresa y Mi perfil", async () => {
  const source = await readFile(
    new URL("../components/layout/mobile-more-sheet.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /href="\/ajustes"/);
  assert.match(source, /href="\/perfil-empresa"/);
  assert.match(source, /href="\/perfil-usuario"/);
  assert.match(source, /SignOutButton/);
});

test("BottomNav usa mobileBarNavItems y la hoja Más", async () => {
  const source = await readFile(
    new URL("../components/layout/bottom-nav.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /mobileBarNavItems/);
  assert.match(source, /MobileMoreSheet/);
  assert.match(source, /grid-cols-6/);
});
