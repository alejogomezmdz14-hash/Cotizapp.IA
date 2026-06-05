import assert from "node:assert/strict";
import test from "node:test";

import { isStorageAccessError } from "../lib/quotation-pdf-errors";

test("isStorageAccessError detects Clerk UUID storage failures", () => {
  assert.equal(
    isStorageAccessError(
      new Error(
        'invalid input syntax for type uuid: "user_3EdCCvrb0TquNYVmfWncpftSYKg"',
      ),
    ),
    true,
  );
});
