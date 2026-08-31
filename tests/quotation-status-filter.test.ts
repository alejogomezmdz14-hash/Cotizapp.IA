import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  formatQuotationStatusLabel,
  matchesQuotationStatusFilter,
  type QuotationStatusFilter,
} from "../lib/quotation-status";

// Estados crudos que pueden vivir en la columna quotations.status: los
// canónicos + los alias legacy que el resto del código sigue contemplando
// (lib/dashboard.ts, migraciones con IN ('accepted', 'approved')).
const RAW_STATUSES = [
  "draft",
  "pending",
  "sent",
  "accepted",
  "approved",
  "rejected",
  "expired",
  " SENT ",
  "cualquier-cosa",
  null,
];

// Mismos chips que components/cotizacion/quotations-list.tsx.
const STATUS_CHIPS: Array<{ id: QuotationStatusFilter; label: string }> = [
  { id: "draft", label: "Borrador" },
  { id: "pending", label: "Enviada" },
  { id: "accepted", label: "Aceptada" },
  { id: "rejected", label: "Rechazada" },
];

test("el chip 'Todas' deja pasar cualquier estado", () => {
  for (const status of RAW_STATUSES) {
    assert.equal(matchesQuotationStatusFilter(status, "all"), true);
  }
});

test("el chip 'Enviada' encuentra las cotizaciones con el alias legacy 'sent'", () => {
  assert.equal(matchesQuotationStatusFilter("pending", "pending"), true);
  assert.equal(matchesQuotationStatusFilter("sent", "pending"), true);
  assert.equal(matchesQuotationStatusFilter(" SENT ", "pending"), true);
});

test("el chip 'Aceptada' encuentra las cotizaciones con el alias legacy 'approved'", () => {
  assert.equal(matchesQuotationStatusFilter("accepted", "accepted"), true);
  assert.equal(matchesQuotationStatusFilter("approved", "accepted"), true);
});

test("el filtro no mezcla estados distintos ni deja pasar basura", () => {
  assert.equal(matchesQuotationStatusFilter("accepted", "pending"), false);
  assert.equal(matchesQuotationStatusFilter("draft", "pending"), false);
  assert.equal(matchesQuotationStatusFilter("expired", "rejected"), false);
  assert.equal(matchesQuotationStatusFilter(null, "draft"), false);
  assert.equal(matchesQuotationStatusFilter("cualquier-cosa", "draft"), false);
});

test("una cotización pasa el chip exactamente cuando su badge dice esa etiqueta", () => {
  for (const chip of STATUS_CHIPS) {
    for (const status of RAW_STATUSES) {
      assert.equal(
        matchesQuotationStatusFilter(status, chip.id),
        formatQuotationStatusLabel(status) === chip.label,
        `El estado ${JSON.stringify(status)} muestra el badge "${formatQuotationStatusLabel(
          status,
        )}" pero no coincide con el chip "${chip.label}".`,
      );
    }
  }
});

test("la lista de cotizaciones filtra por el estado normalizado, no por el crudo", async () => {
  const source = await readFile(
    new URL("../components/cotizacion/quotations-list.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /matchesQuotationStatusFilter\(\s*quotation\.status,/);
  assert.doesNotMatch(source, /quotation\.status === statusFilter/);
});
