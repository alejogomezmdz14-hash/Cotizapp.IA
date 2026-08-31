import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function leerComponente(rutaRelativa: string) {
  return readFile(new URL(`../${rutaRelativa}`, import.meta.url), "utf8");
}

function extraerInputsDeArchivo(source: string): string[] {
  return (source.match(/<input[\s\S]*?\/>/g) ?? []).filter((tag) =>
    tag.includes('type="file"'),
  );
}

function extraerBoton(source: string, marcador: string): string {
  const posicionMarcador = source.indexOf(marcador);
  assert.notEqual(posicionMarcador, -1, `no se encontró "${marcador}"`);

  const inicio = source.lastIndexOf("<Button", posicionMarcador);
  const fin = source.indexOf("</Button>", posicionMarcador);
  assert.notEqual(inicio, -1, `no se encontró el <Button> de "${marcador}"`);
  assert.notEqual(fin, -1, `no se encontró el </Button> de "${marcador}"`);

  return source.slice(inicio, fin);
}

const RUTAS_CON_CAMARA = [
  "components/uploads/invoice-dropzone.tsx",
  "components/gastos/expense-form-sheet.tsx",
];

for (const ruta of RUTAS_CON_CAMARA) {
  test(`${ruta} tiene un input que abre la cámara del teléfono`, async () => {
    const source = await leerComponente(ruta);
    const inputs = extraerInputsDeArchivo(source);
    const inputsDeCamara = inputs.filter((tag) =>
      tag.includes('capture="environment"'),
    );

    assert.equal(
      inputsDeCamara.length,
      1,
      "tiene que haber exactamente un input con capture",
    );
    assert.match(inputsDeCamara[0], /accept="image\/\*"/);
    assert.match(source, /Sacar foto/);
  });

  test(`${ruta} conserva un input sin capture para galería y archivos`, async () => {
    const source = await leerComponente(ruta);
    const inputs = extraerInputsDeArchivo(source);
    const inputsSinCaptura = inputs.filter((tag) => !tag.includes("capture="));

    // `capture` fuerza la cámara y saca la opción de galería/archivos en el
    // móvil: el input original tiene que seguir existiendo sin capture.
    assert.equal(
      inputsSinCaptura.length,
      1,
      "tiene que quedar exactamente un input sin capture",
    );
    assert.match(
      inputsSinCaptura[0],
      /accept="image\/png,image\/jpeg,image\/webp,application\/pdf"/,
    );
  });

  test(`${ruta} deja el botón de cámara siempre disponible`, async () => {
    const source = await leerComponente(ruta);
    const boton = extraerBoton(source, "cameraInputRef.current?.click()");

    assert.match(boton, /Sacar foto/);
    // Nunca puede depender de que ya haya un archivo elegido: es justamente el
    // botón que consigue el archivo.
    assert.doesNotMatch(boton, /selectedFile|receiptPath/);
  });
}

test("el botón de escaneo de gastos explica en pantalla por qué está bloqueado", async () => {
  const source = await leerComponente("components/gastos/expense-form-sheet.tsx");
  const boton = extraerBoton(source, "onClick={handleScanReceipt}");

  // El motivo no puede vivir en un `title`: en un teléfono no hay hover.
  assert.doesNotMatch(boton, /title=/);
  assert.match(boton, /Leer ticket con IA/);
  assert.doesNotMatch(source, /Sacale una foto al ticket/);
  assert.match(source, /<ActionHint>[\s\S]*?Leer ticket con IA[\s\S]*?<\/ActionHint>/);
});
