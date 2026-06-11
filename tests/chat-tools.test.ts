import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClientSelectorReply,
  formatClientesListForChatReply,
} from "../lib/chat/client-list-format";

test("formatClientesListForChatReply lists numbered clients with ids", () => {
  const reply = formatClientesListForChatReply([
    {
      id: "client-1",
      nombre: "Juan Pérez",
      email: null,
      telefono: "2615551234",
    },
    {
      id: "client-2",
      nombre: "María López",
      email: "maria@demo.com",
      telefono: null,
    },
  ]);

  assert.match(reply, /1\. Juan Pérez \(2615551234\) \[id: client-1\]/);
  assert.match(reply, /2\. María López \[id: client-2\]/);
  assert.match(reply, /¿Para cuál cliente es la cotización\?/);
});

test("formatClientesListForChatReply handles empty client lists", () => {
  const reply = formatClientesListForChatReply([]);
  assert.match(reply, /Todavía no tenés clientes cargados/i);
});

test("buildClientSelectorReply returns uiHint with client selector", () => {
  const payload = buildClientSelectorReply([
    {
      id: "client-1",
      nombre: "Juan Pérez",
      email: null,
      telefono: "2615551234",
    },
  ]);

  assert.equal(payload.reply, "¿Para cuál cliente es la cotización?");
  assert.equal(payload.suggestedAction, null);
  assert.deepEqual(payload.uiHint, {
    type: "client_selector",
    clients: [
      {
        id: "client-1",
        nombre: "Juan Pérez",
        email: null,
        telefono: "2615551234",
      },
    ],
  });
});
