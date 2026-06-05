import assert from "node:assert/strict";
import test from "node:test";

import {
  remapStoragePathOwner,
  resolveLogoStoragePath,
} from "../lib/storage/profile-paths";

test("resolveLogoStoragePath remaps legacy Clerk-prefixed logo paths to profile UUID", () => {
  const profileId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const clerkId = "user_3EdCCvrb0TquNYVmfWncpftSYKg";

  assert.equal(
    resolveLogoStoragePath(`${clerkId}/logo/marca.png`, {
      id: profileId,
      clerk_id: clerkId,
    }),
    `${profileId}/logo/marca.png`,
  );
});

test("remapStoragePathOwner leaves UUID-prefixed paths unchanged", () => {
  const profileId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  assert.equal(
    remapStoragePathOwner(
      `${profileId}/logo/marca.png`,
      "user_clerk_1",
      profileId,
    ),
    `${profileId}/logo/marca.png`,
  );
});
