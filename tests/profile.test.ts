import assert from "node:assert/strict";
import test from "node:test";

import { buildOnboardingProfileUpsertInput } from "../lib/profile";

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
