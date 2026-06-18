export const PROFILE_COUNTRIES = [
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Ecuador",
  "México",
  "Paraguay",
  "Perú",
  "Uruguay",
  "Venezuela",
  "Otro",
] as const;

export type ProfileCountry = (typeof PROFILE_COUNTRIES)[number];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function isArgentina(country: string | null | undefined): boolean {
  if (!country) {
    return false;
  }

  const normalized = normalize(country);
  return normalized === "argentina" || normalized === "ar";
}
