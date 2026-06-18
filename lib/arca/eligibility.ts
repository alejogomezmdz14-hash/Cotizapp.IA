// Elegibilidad para emitir Factura C. El formato del CUIT ya se valida al
// capturar los datos fiscales, así que acá solo chequeamos presencia + que sea
// monotributista (v1 solo emite Factura C).

export type BillingFiscalProfile = {
  cuit: string | null;
  sales_point: string | null;
  contributor_type: string | null;
  cert_path: string | null;
  key_path: string | null;
  environment?: string | null;
};

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isDemoEnvironment(
  profile: Pick<BillingFiscalProfile, "environment"> | null | undefined,
): boolean {
  return profile?.environment === "demo";
}

export function isFiscalProfileComplete(
  profile: BillingFiscalProfile | null | undefined,
): boolean {
  if (!profile) {
    return false;
  }

  const hasBasics =
    isFilled(profile.cuit) &&
    isFilled(profile.sales_point) &&
    profile.contributor_type === "monotributista";

  // En modo demo simulamos la emisión (no se llama a ARCA), así que no hace falta
  // certificado ni clave.
  if (isDemoEnvironment(profile)) {
    return hasBasics;
  }

  return hasBasics && isFilled(profile.cert_path) && isFilled(profile.key_path);
}
