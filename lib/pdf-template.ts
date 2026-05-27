export const PDF_TEMPLATE_IDS = ["classic", "modern", "minimal"] as const;

export type PdfTemplateId = (typeof PDF_TEMPLATE_IDS)[number];

export const PDF_TEMPLATE_OPTIONS: Array<{
  id: PdfTemplateId;
  label: string;
  description: string;
}> = [
  {
    id: "classic",
    label: "Clásica",
    description: "Header blanco, tabla simple y totales a la derecha.",
  },
  {
    id: "modern",
    label: "Moderna",
    description: "Header con color de acento y filas alternadas.",
  },
  {
    id: "minimal",
    label: "Minimalista",
    description: "Sin colores fuertes, solo tipografía y líneas finas.",
  },
];

export function normalizePdfTemplate(value: string | null | undefined): PdfTemplateId {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === "modern" || normalizedValue === "minimal") {
    return normalizedValue;
  }

  return "classic";
}
