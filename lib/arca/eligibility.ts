// Elegibilidad para emitir Factura C. El formato del CUIT ya se valida al
// capturar los datos fiscales, así que acá solo chequeamos presencia + que sea
// monotributista (v1 solo emite Factura C).
//
// Ojo: esto NO dice que el usuario tenga un certificado válido. Eso vive en
// `fiscal_credentials.verified_at` y lo chequea quien va a emitir. Acá solo se
// mira que los datos de texto del perfil estén completos.

export type BillingFiscalProfile = {
  cuit: string | null;
  sales_point: string | null;
  contributor_type: string | null;
};

function isFilled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isFiscalProfileComplete(
  profile: BillingFiscalProfile | null | undefined,
): boolean {
  if (!profile) {
    return false;
  }

  return (
    isFilled(profile.cuit) &&
    isFilled(profile.sales_point) &&
    profile.contributor_type === "monotributista"
  );
}
