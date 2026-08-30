import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("user-profile-form usa un selector de país poblado con PROFILE_COUNTRIES", async () => {
  const source = await readFile(
    new URL("../components/profile/user-profile-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /PROFILE_COUNTRIES/);
  assert.match(source, /<(select|NativeSelect)[\s\S]*name="country"/);
});

test("FiscalProfileForm tiene los campos fiscales y el disclaimer", async () => {
  const source = await readFile(
    new URL("../components/profile/fiscal-profile-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /saveFiscalProfileAction/);
  assert.match(source, /name="cuit"/);
  assert.match(source, /name="contributor_type"/);
  assert.match(source, /name="sales_point"/);
  assert.match(source, /name="business_name"/);
  assert.match(source, /consultá a tu contador/);
});

test("FiscalProfileForm ya no sube archivos ni deja elegir entorno", async () => {
  const source = await readFile(
    new URL("../components/profile/fiscal-profile-form.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /name="cert"/);
  assert.doesNotMatch(source, /name="key"/);
  assert.doesNotMatch(source, /name="environment"/);
  assert.doesNotMatch(source, /responsable_inscripto/);
  assert.match(source, /Por ahora Cotizapp emite Factura C/);
});

test("perfil-empresa monta el CertificadoWizard antes del form fiscal", async () => {
  const source = await readFile(
    new URL("../app/(dashboard)/perfil-empresa/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /CertificadoWizard/);
  assert.match(source, /pasoDelWizard/);

  const wizardIndex = source.indexOf("<CertificadoWizard");
  const formIndex = source.indexOf("<FiscalProfileForm");
  assert.ok(wizardIndex > -1 && formIndex > -1 && wizardIndex < formIndex);
});

test("perfil-empresa renderiza FiscalProfileForm solo si isArgentina", async () => {
  const source = await readFile(
    new URL("../app/(dashboard)/perfil-empresa/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /isArgentina/);
  assert.match(source, /<FiscalProfileForm/);
});
