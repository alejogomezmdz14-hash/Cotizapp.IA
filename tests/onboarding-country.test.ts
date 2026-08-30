import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OnboardingForm pregunta el país con PROFILE_COUNTRIES y Argentina preseleccionada", async () => {
  const source = await readFile(
    new URL("../components/uploads/onboarding-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /PROFILE_COUNTRIES/);
  assert.match(source, /<(select|NativeSelect)[\s\S]*name="country"/);
  assert.match(source, /defaultValue=\{profile\?\.country \?\? "Argentina"\}/);
});

test("el contador de pasos lo pone el formulario, no la página", async () => {
  // El alta pasó de un formulario largo a un wizard de un paso por pantalla.
  // El contador tiene que vivir en un solo lugar: el formulario, que es quien
  // sabe en qué paso está. Si la página vuelve a poner uno fijo, se contradicen.
  const page = await readFile(
    new URL("../app/onboarding/page.tsx", import.meta.url),
    "utf8",
  );
  const form = await readFile(
    new URL("../components/uploads/onboarding-form.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(page, /Último paso/);
  assert.doesNotMatch(page, /Paso \d+ de \d+/);
  assert.match(form, /Paso \{paso \+ 1\} de \{TOTAL_PASOS\}/);
});

test("el wizard sólo exige los campos del paso visible", async () => {
  // Un campo `required` oculto hace que el navegador intente enfocar algo
  // invisible y trabe el envío con un error que el usuario no puede resolver.
  const source = await readFile(
    new URL("../components/uploads/onboarding-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /required=\{paso === 0\}/);
  assert.match(source, /required=\{paso === 1\}/);
  assert.match(source, /required=\{paso === 2\}/);
  assert.doesNotMatch(source, /\n\s+required\n/);
});
