import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildBusinessProfileUpsertInput,
  buildOnboardingProfileUpsertInput,
  isProfileComplete,
  readOptionalFormField,
} from "../lib/profile";
import { isArgentina } from "../lib/profile-countries";

test("readOptionalFormField distingue un campo ausente de uno enviado vacío", () => {
  const conValor = new FormData();
  conValor.set("pdf_footer", "  Gracias por confiar en nosotros  ");
  assert.equal(
    readOptionalFormField(conValor, "pdf_footer"),
    "Gracias por confiar en nosotros",
  );

  // Enviado pero vacío = el usuario lo borró a propósito.
  const vacio = new FormData();
  vacio.set("pdf_footer", "   ");
  assert.equal(readOptionalFormField(vacio, "pdf_footer"), null);

  // Ausente = ese formulario no edita el campo, no hay que tocar la columna.
  assert.equal(readOptionalFormField(new FormData(), "pdf_footer"), undefined);
});

test("guardar los datos del negocio no pisa el pie de página del PDF", async () => {
  // El form de Mi empresa no incluye pdf_footer. Leerlo con getOptionalValue
  // devuelve null, y buildBusinessProfileUpsertInput solo omite la columna
  // cuando es undefined: con null la escribe y borra el pie configurado en la
  // pantalla de PDF.
  const source = await readFile(
    new URL("../app/actions/profile.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /pdfFooter: getOptionalValue\(formData, "pdf_footer"\)/,
    "getOptionalValue colapsa ausente y vacío en null, y null borra la columna",
  );
  assert.match(
    source,
    /pdfFooter: readOptionalFormField\(formData, "pdf_footer"\)/,
  );
});

test("buildBusinessProfileUpsertInput omite pdf_footer cuando el form no lo envió", () => {
  const payload = buildBusinessProfileUpsertInput({
    userId: "user-1",
    clerkId: "user_clerk_1",
    businessName: "Corralon Centro",
    industry: "Construccion",
    phone: "2615551234",
    email: null,
    fallbackEmail: "ventas@corralon.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
    pdfFooter: undefined,
  });

  assert.equal("pdf_footer" in payload, false);
});

test("buildOnboardingProfileUpsertInput omits logo_url so onboarding does not overwrite uploads", () => {
  const payload = buildOnboardingProfileUpsertInput({
    userId: "user-1",
    clerkId: "user_clerk_1",
    businessName: "Corralon Centro",
    industry: "Construccion",
    phone: "2615551234",
    email: null,
    fallbackEmail: "ventas@corralon.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
  });

  assert.deepEqual(payload, {
    id: "user-1",
    clerk_id: "user_clerk_1",
    business_name: "Corralon Centro",
    industry: "Construccion",
    phone: "2615551234",
    email: "ventas@corralon.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
  });
  assert.equal("logo_url" in payload, false);
});

test("buildOnboardingProfileUpsertInput persists country with a value isArgentina recognizes", () => {
  const payload = buildOnboardingProfileUpsertInput({
    userId: "user-1",
    clerkId: "user_clerk_1",
    businessName: "Corralon Centro",
    industry: "Construccion",
    phone: "2615551234",
    email: null,
    fallbackEmail: "ventas@corralon.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
    country: "Argentina",
  });

  assert.equal(payload.country, "Argentina");
  assert.equal(isArgentina(payload.country), true);
});

test("buildOnboardingProfileUpsertInput omits country when it is not provided", () => {
  const payload = buildOnboardingProfileUpsertInput({
    userId: "user-1",
    clerkId: "user_clerk_1",
    businessName: "Corralon Centro",
    industry: "Construccion",
    phone: "2615551234",
    email: null,
    fallbackEmail: "ventas@corralon.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
  });

  assert.equal("country" in payload, false);
});

test("isProfileComplete treats legacy profiles without logo onboarding flag as complete", () => {
  assert.equal(
    isProfileComplete({
      id: "user-1",
      business_name: "Corralon Centro",
      industry: "Construccion",
    } as never),
    true,
  );
});

test("isProfileComplete requires logo onboarding when the flag exists", () => {
  assert.equal(
    isProfileComplete({
      id: "user-1",
      business_name: "Corralon Centro",
      industry: "Construccion",
      logo_onboarding_completed: false,
    } as never),
    false,
  );
});

test("buildBusinessProfileUpsertInput keeps logo and PDF footer when saving the business profile", () => {
  const payload = buildBusinessProfileUpsertInput({
    userId: "user-1",
    clerkId: "user_clerk_1",
    businessName: "Corralon Centro",
    industry: "Construccion",
    phone: "2615551234",
    email: "ventas@corralon.com",
    fallbackEmail: "owner@corralon.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
    pdfFooter: "Precios sujetos a cambios sin previo aviso.",
    logoPath: "user-1/logo/logo.png",
  });

  assert.deepEqual(payload, {
    id: "user-1",
    clerk_id: "user_clerk_1",
    business_name: "Corralon Centro",
    industry: "Construccion",
    logo_url: "user-1/logo/logo.png",
    phone: "2615551234",
    email: "ventas@corralon.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
    pdf_footer: "Precios sujetos a cambios sin previo aviso.",
  });
});
