import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQuotationWhatsAppShareMessage,
  buildWhatsAppShareHref,
  formatShortQuotationNumber,
} from "../lib/whatsapp";

test("formatShortQuotationNumber keeps the prefix and final segment", () => {
  assert.equal(
    formatShortQuotationNumber("COT-20260525-145607-A1B2C3"),
    "COT-#A1B2C3",
  );
  assert.equal(formatShortQuotationNumber("COT-001"), "COT-#001");
});

test("buildQuotationWhatsAppShareMessage omits greeting when client name is missing", () => {
  const message = buildQuotationWhatsAppShareMessage({
    clientName: null,
    businessName: "Pro Mat",
    quotationNumber: "COT-20260525-145607-A1B2C3",
    totalLabel: "$ 121.000,00",
    validUntilLabel: "30 jun 2026",
    shareUrl: "https://cotizapp.vercel.app/api/quotations/share/token-1",
  });

  assert.doesNotMatch(message, /^Hola /);
  assert.match(message, /📄 \*COT-#A1B2C3\*/);
  assert.match(message, /💰 Total: \*\$ 121\.000,00\*/);
  assert.match(message, /📅 Válida hasta: \*30 jun 2026\*/);
  assert.match(
    message,
    /👉 Ver y descargar: https:\/\/cotizapp\.vercel\.app\/api\/quotations\/share\/token-1/,
  );
  assert.match(message, /_Pro Mat_$/);
});

test("buildQuotationWhatsAppShareMessage greets the client by name when available", () => {
  const message = buildQuotationWhatsAppShareMessage({
    clientName: "María López",
    businessName: "Pro Mat",
    quotationNumber: "COT-20260525-145607-A1B2C3",
    totalLabel: "$ 121.000,00",
    validUntilLabel: "30 jun 2026",
    shareUrl: "https://cotizapp.vercel.app/api/quotations/share/token-1",
  });

  assert.match(message, /^Hola María López! 👋/);
});

test("buildWhatsAppShareHref encodes the full message with encodeURIComponent", () => {
  const text = buildQuotationWhatsAppShareMessage({
    clientName: "María",
    businessName: "Pro Mat",
    quotationNumber: "COT-20260525-145607-A1B2C3",
    totalLabel: "$ 10.000,00",
    validUntilLabel: "30 jun 2026",
    shareUrl: "https://cotizapp.vercel.app/api/quotations/share/token-1",
  });
  const href = buildWhatsAppShareHref({
    phone: "261 555 1234",
    text,
  });

  assert.equal(
    href,
    `https://wa.me/5492615551234?text=${encodeURIComponent(text)}`,
  );
});
