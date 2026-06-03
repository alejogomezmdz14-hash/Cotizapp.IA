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
    description: "Clásica: limpia y ordenada",
  },
  {
    id: "modern",
    label: "Moderna",
    description: "Moderna: con color y estilo",
  },
  {
    id: "minimal",
    label: "Minimalista",
    description: "Simple: solo texto y líneas",
  },
];

export function normalizePdfTemplate(value: string | null | undefined): PdfTemplateId {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === "modern" || normalizedValue === "minimal") {
    return normalizedValue;
  }

  return "classic";
}
