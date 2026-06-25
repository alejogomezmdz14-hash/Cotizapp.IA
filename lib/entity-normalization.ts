export function formatDisplayName(value: string | null | undefined) {
  if (!value?.trim()) {
    return value ?? "";
  }

  return normalizeEntityName(value);
}

export function normalizeEntityName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => {
      if (segment.length === 0) {
        return segment;
      }

      // Respetar tokens que ya vienen en mayúscula (acrónimos: PVC, QA, SRL,
      // S.A.). Solo title-caseamos los que tienen alguna minúscula o son todo
      // minúscula, para no transformar "PVC" en "Pvc" ni "QA" en "Qa".
      const hasLowercase = /[a-záéíóúüñ]/.test(segment);
      const hasUppercase = /[A-ZÁÉÍÓÚÜÑ]/.test(segment);

      if (!hasLowercase && hasUppercase) {
        return segment;
      }

      return `${segment[0]!.toUpperCase()}${segment.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

export function hasMinimumPhoneDigits(value: string | null, minimumDigits = 8) {
  if (!value) {
    return true;
  }

  const digits = value.replace(/\D+/g, "");
  return digits.length >= minimumDigits;
}
