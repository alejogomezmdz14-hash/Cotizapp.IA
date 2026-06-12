export const PROFILE_CURRENCIES = [
  "ARS",
  "USD",
  "EUR",
  "MXN",
  "COP",
  "CLP",
  "BRL",
  "UYU",
] as const;

const SUPPORTED_PROFILE_CURRENCIES = new Set<string>(PROFILE_CURRENCIES);

export function normalizeProfileCurrency(currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase();

  if (!SUPPORTED_PROFILE_CURRENCIES.has(normalizedCurrency)) {
    throw new Error("Seleccioná una moneda válida para el perfil.");
  }

  return normalizedCurrency;
}
