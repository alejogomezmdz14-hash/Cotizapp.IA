import assert from "node:assert/strict";
import test from "node:test";

import { assertCatalogPriceSuggestionIsCurrent } from "../lib/ai/catalog-price-updates";

test("assertCatalogPriceSuggestionIsCurrent accepts matching prices", () => {
  assert.doesNotThrow(() => {
    assertCatalogPriceSuggestionIsCurrent({
      itemName: "Cemento portland",
      currentPrice: 3525.75,
      suggestedCurrentPrice: 3525.75,
    });
  });
});

test("assertCatalogPriceSuggestionIsCurrent rejects stale price suggestions", () => {
  assert.throws(
    () =>
      assertCatalogPriceSuggestionIsCurrent({
        itemName: "Cemento portland",
        currentPrice: 4100,
        suggestedCurrentPrice: 3525.75,
      }),
    /El precio actual de Cemento portland ya cambio desde que la IA genero la sugerencia\./,
  );
});
