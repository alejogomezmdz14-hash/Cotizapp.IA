import assert from "node:assert/strict";
import test from "node:test";

import {
  TRIAL_INVOICE_LIMIT,
  TRIAL_INVOICE_SCAN_LIMIT,
  TRIAL_QUOTATION_LIMIT,
  canCreateQuotation,
  canIssueInvoice,
  canScanInvoice,
  trialRemaining,
} from "../lib/trial";

test("canCreateQuotation permite mientras el trial esté bajo el límite", () => {
  assert.equal(canCreateQuotation(0, false), true);
  assert.equal(canCreateQuotation(TRIAL_QUOTATION_LIMIT - 1, false), true);
});

test("canCreateQuotation bloquea al llegar y al pasar el límite del trial", () => {
  assert.equal(canCreateQuotation(TRIAL_QUOTATION_LIMIT, false), false);
  assert.equal(canCreateQuotation(TRIAL_QUOTATION_LIMIT + 5, false), false);
});

test("canCreateQuotation siempre permite si es pago (ilimitado)", () => {
  assert.equal(canCreateQuotation(0, true), true);
  assert.equal(canCreateQuotation(TRIAL_QUOTATION_LIMIT, true), true);
  assert.equal(canCreateQuotation(TRIAL_QUOTATION_LIMIT + 100, true), true);
});

test("canScanInvoice permite mientras el trial esté bajo el límite", () => {
  assert.equal(canScanInvoice(0, false), true);
  assert.equal(canScanInvoice(TRIAL_INVOICE_SCAN_LIMIT - 1, false), true);
});

test("canScanInvoice bloquea al llegar y al pasar el límite del trial", () => {
  assert.equal(canScanInvoice(TRIAL_INVOICE_SCAN_LIMIT, false), false);
  assert.equal(canScanInvoice(TRIAL_INVOICE_SCAN_LIMIT + 3, false), false);
});

test("canScanInvoice siempre permite si es pago (ilimitado)", () => {
  assert.equal(canScanInvoice(0, true), true);
  assert.equal(canScanInvoice(TRIAL_INVOICE_SCAN_LIMIT, true), true);
  assert.equal(canScanInvoice(TRIAL_INVOICE_SCAN_LIMIT + 100, true), true);
});

test("canIssueInvoice permite mientras el trial esté bajo el límite", () => {
  assert.equal(canIssueInvoice(0, false), true);
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT - 1, false), true);
});

test("canIssueInvoice bloquea al llegar y al pasar el límite del trial", () => {
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT, false), false);
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT + 10, false), false);
});

test("canIssueInvoice siempre permite si es pago (ilimitado)", () => {
  assert.equal(canIssueInvoice(0, true), true);
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT, true), true);
  assert.equal(canIssueInvoice(TRIAL_INVOICE_LIMIT + 100, true), true);
});

test("trialRemaining nunca devuelve negativo", () => {
  assert.equal(trialRemaining(0, TRIAL_QUOTATION_LIMIT), TRIAL_QUOTATION_LIMIT);
  assert.equal(trialRemaining(5, TRIAL_QUOTATION_LIMIT), TRIAL_QUOTATION_LIMIT - 5);
  assert.equal(trialRemaining(TRIAL_QUOTATION_LIMIT, TRIAL_QUOTATION_LIMIT), 0);
  assert.equal(trialRemaining(TRIAL_QUOTATION_LIMIT + 10, TRIAL_QUOTATION_LIMIT), 0);
});
