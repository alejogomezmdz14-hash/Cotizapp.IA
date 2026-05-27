import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBusinessProfileUpsertInput,
  buildOnboardingProfileUpsertInput,
  isProfileComplete,
} from "../lib/profile";

test("buildOnboardingProfileUpsertInput omits logo_url so onboarding does not overwrite uploads", () => {
  const payload = buildOnboardingProfileUpsertInput({
    userId: "user-1",
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
    business_name: "Corralon Centro",
    industry: "Construccion",
    phone: "2615551234",
    email: "ventas@corralon.com",
    address: "Rodriguez Pena 3341",
    currency: "ARS",
  });
  assert.equal("logo_url" in payload, false);
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
