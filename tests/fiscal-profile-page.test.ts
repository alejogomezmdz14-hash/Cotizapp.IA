import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("user-profile-form usa un selector de país poblado con PROFILE_COUNTRIES", async () => {
  const source = await readFile(
    new URL("../components/profile/user-profile-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /PROFILE_COUNTRIES/);
  assert.match(source, /<select[\s\S]*name="country"/);
});
