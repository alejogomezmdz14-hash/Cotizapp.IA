const PDF_ACCENT_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const DEFAULT_PDF_ACCENT_COLOR = "#00E5A0";

export const PDF_ACCENT_PRESETS = [
  "#00E5A0",
  "#00C984",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#111827",
] as const;

export function normalizePdfAccentColor(value: string | null | undefined) {
  const normalizedValue = value?.trim().toUpperCase();

  if (!normalizedValue) {
    return DEFAULT_PDF_ACCENT_COLOR;
  }

  const withHash = normalizedValue.startsWith("#")
    ? normalizedValue
    : `#${normalizedValue}`;

  if (!PDF_ACCENT_COLOR_PATTERN.test(withHash)) {
    return DEFAULT_PDF_ACCENT_COLOR;
  }

  return withHash;
}
