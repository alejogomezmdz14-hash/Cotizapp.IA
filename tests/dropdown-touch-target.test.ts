import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dropdownMenuUrl = new URL(
  "../components/ui/dropdown-menu.tsx",
  import.meta.url,
);
const signOutButtonUrl = new URL(
  "../components/layout/sign-out-button.tsx",
  import.meta.url,
);

/** Aísla el bloque de código de una constante del archivo. */
function blockFor(source: string, constName: string) {
  const start = source.indexOf(`const ${constName} =`);
  assert.notEqual(start, -1, `No existe "const ${constName} =" en el archivo`);

  const end = source.indexOf("\nconst ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

// Escala por defecto de Tailwind (el config sólo usa `extend`):
// py-3 = 12px arriba + 12px abajo sobre una línea de text-sm (20px) => 44px.
// min-h-11 = 2.75rem = 44px y cubre el caso de textos cortos.
const FILAS_TOCABLES = [
  "DropdownMenuSubTrigger",
  "DropdownMenuItem",
  "DropdownMenuCheckboxItem",
  "DropdownMenuRadioItem",
];

test("cada fila tocable del dropdown llega a 44px de alto", async () => {
  const source = await readFile(dropdownMenuUrl, "utf8");

  for (const primitive of FILAS_TOCABLES) {
    const block = blockFor(source, primitive);

    assert.match(
      block,
      /\bmin-h-11\b/,
      `${primitive} tiene que declarar min-h-11 (44px)`,
    );
    assert.match(block, /\bpy-3\b/, `${primitive} tiene que declarar py-3`);
    assert.doesNotMatch(
      block,
      /\bpy-1\.5\b/,
      `${primitive} no puede seguir con py-1.5 (32px)`,
    );
  }
});

test("DropdownMenuLabel sigue compacto: no es una fila tocable", async () => {
  const source = await readFile(dropdownMenuUrl, "utf8");
  const block = blockFor(source, "DropdownMenuLabel");

  assert.match(block, /\bpy-1\.5\b/);
  assert.doesNotMatch(block, /\bmin-h-11\b/);
});

test("el menú hace scroll en vez de desbordar la pantalla", async () => {
  const source = await readFile(dropdownMenuUrl, "utf8");
  const block = blockFor(source, "DropdownMenuContent");

  assert.match(
    block,
    /max-h-\[var\(--radix-dropdown-menu-content-available-height\)\]/,
  );
  assert.match(block, /\boverflow-y-auto\b/);
  assert.doesNotMatch(
    block,
    /\boverflow-hidden\b/,
    "overflow-hidden bloquearía el scroll vertical del menú",
  );
});

test("Cerrar sesión dentro del menú también llega a 44px", async () => {
  const source = await readFile(signOutButtonUrl, "utf8");

  assert.match(source, /min-h-11 w-full cursor-pointer/);
  assert.match(source, /px-2 py-3 text-sm outline-none hover:bg-accent/);
});
