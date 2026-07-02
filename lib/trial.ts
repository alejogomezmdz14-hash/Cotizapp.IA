/**
 * Trial / freemium por uso. Helpers PUROS (sin imports de server) para poder
 * testearlos con `tsx --test`. El enforcement server-side (lectura/escritura de
 * contadores en `profiles`) vive en `lib/trial-usage.ts`.
 *
 * Modelo: los planes pagos (`lifetime`/`pro`, ver `lib/auth/plan.ts`) son
 * ilimitados. El resto arranca un trial con cupo total (no mensual).
 */

export const TRIAL_QUOTATION_LIMIT = 15;
export const TRIAL_INVOICE_SCAN_LIMIT = 10;

/** Mensaje de error reconocible que lanza `createDraftQuotationAction` cuando el
 * trial se quedó sin cupo. La UI lo traduce al paywall en vez del error genérico. */
export const QUOTATION_TRIAL_LIMIT_ERROR = "__TRIAL_LIMIT_QUOTATIONS__";

/** WhatsApp del fundador con mensaje precargado para pasar a Pro (upgrade manual). */
export const UPGRADE_WHATSAPP =
  "https://wa.me/542617679830?text=" +
  encodeURIComponent("Hola! Quiero pasar a Pro en Cotizapp.");

/** ¿Puede crear otra cotización? Los pagos siempre pueden; el trial hasta el cupo. */
export function canCreateQuotation(
  quotationsUsed: number,
  isPaid: boolean,
): boolean {
  if (isPaid) {
    return true;
  }

  return quotationsUsed < TRIAL_QUOTATION_LIMIT;
}

/** ¿Puede escanear otra factura? Los pagos siempre pueden; el trial hasta el cupo. */
export function canScanInvoice(
  invoiceScansUsed: number,
  isPaid: boolean,
): boolean {
  if (isPaid) {
    return true;
  }

  return invoiceScansUsed < TRIAL_INVOICE_SCAN_LIMIT;
}

/** Cupo restante (nunca negativo) para mostrar en banners/UI del trial. */
export function trialRemaining(used: number, limit: number): number {
  return Math.max(0, limit - used);
}
