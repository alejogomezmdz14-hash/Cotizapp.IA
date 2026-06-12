type CatalogPriceSuggestionFreshnessInput = {
  itemName: string;
  currentPrice: number;
  suggestedCurrentPrice: number;
};

const PRICE_COMPARISON_EPSILON = 0.000001;

export function assertCatalogPriceSuggestionIsCurrent({
  itemName,
  currentPrice,
  suggestedCurrentPrice,
}: CatalogPriceSuggestionFreshnessInput) {
  if (Math.abs(currentPrice - suggestedCurrentPrice) <= PRICE_COMPARISON_EPSILON) {
    return;
  }

  throw new Error(
    `El precio actual de ${itemName} ya cambio desde que la IA genero la sugerencia. Revisá el valor vigente antes de confirmar.`,
  );
}
