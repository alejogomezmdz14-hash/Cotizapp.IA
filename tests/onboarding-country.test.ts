import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OnboardingForm pregunta el país con PROFILE_COUNTRIES y Argentina preseleccionada", async () => {
  const source = await readFile(
    new URL("../components/uploads/onboarding-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /PROFILE_COUNTRIES/);
  assert.match(source, /<select[\s\S]*name="country"/);
  assert.match(source, /defaultValue=\{profile\?\.country \?\? "Argentina"\}/);
});

test("app/onboarding no dice 'Último paso' y 'Paso 1 de 2' en la misma pantalla", async () => {
  const source = await readFile(
    new URL("../app/onboarding/page.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /Último paso/);
  assert.match(source, /Paso 1 de 2/);
});
