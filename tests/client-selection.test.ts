import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultQuotationClientId } from "../lib/quotation-client-selection";

test("getDefaultQuotationClientId auto-selects the only available client", () => {
  assert.equal(
    getDefaultQuotationClientId([
      {
        id: "client-1",
        user_id: "user-1",
        name: "Alejo Gomez",
        email: null,
        phone: null,
        address: null,
        created_at: null,
      },
    ]),
    "client-1",
  );
});

test("getDefaultQuotationClientId keeps selection empty when there are multiple clients", () => {
  assert.equal(
    getDefaultQuotationClientId([
      {
        id: "client-1",
        user_id: "user-1",
        name: "Alejo Gomez",
        email: null,
        phone: null,
        address: null,
        created_at: null,
      },
      {
        id: "client-2",
        user_id: "user-1",
        name: "Obra Norte",
        email: null,
        phone: null,
        address: null,
        created_at: null,
      },
    ]),
    null,
  );
});
