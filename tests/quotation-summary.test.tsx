import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import React from "react";

import { QuotationShareActions } from "../components/cotizacion/quotation-share-actions";
import { QuotationSummary } from "../components/cotizacion/quotation-summary";

globalThis.React = React;

function treeContainsElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => treeContainsElement(child, predicate));
  }

  if (!React.isValidElement(node)) {
    return false;
  }

  if (predicate(node)) {
    return true;
  }

  const props = node.props as { children?: React.ReactNode };
  return treeContainsElement(props.children, predicate);
}

test("QuotationSummary forwards share state changes to QuotationShareActions", () => {
  const onStateChange = () => {};
  const element = QuotationSummary({
    items: [{ quantity: 2, unitPrice: 1000 }],
    currency: "ARS",
    taxRate: 21,
    validUntil: "2026-05-30",
    isSaved: true,
    quotationId: "quotation-1",
    draftNumber: "COT-20260526-010000-ABC123",
    onStateChange,
  } as Parameters<typeof QuotationSummary>[0] & {
    onStateChange?: typeof onStateChange;
  });

  assert.equal(
    treeContainsElement(
      element,
      (treeElement) =>
        treeElement.type === QuotationShareActions &&
        (treeElement.props as { onStateChange?: unknown }).onStateChange ===
          onStateChange,
    ),
    true,
  );
});

test("QuotationForm threads the sidebar share callback into QuotationSummary", async () => {
  const source = await readFile(
    new URL("../components/cotizacion/quotation-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /<QuotationSummary[\s\S]*onStateChange=\{handleShareStateChange\}/,
  );
});
