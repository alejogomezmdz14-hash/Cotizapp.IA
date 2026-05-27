export function normalizePhoneForWhatsApp(phone: string | null) {
  if (!phone) {
    return null;
  }

  const trimmedPhone = phone.trim();
  const digitsOnly = trimmedPhone.replace(/\D+/g, "");

  if (!digitsOnly) {
    return null;
  }

  if (/^549\d{10}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  if (/^54\d{10}$/.test(digitsOnly)) {
    return `549${digitsOnly.slice(2)}`;
  }

  if (/^0\d{10}$/.test(digitsOnly)) {
    return `549${digitsOnly.slice(1)}`;
  }

  if (/^\d{10}$/.test(digitsOnly)) {
    return `549${digitsOnly}`;
  }

  const normalizedInternationalPhone = trimmedPhone.startsWith("+")
    ? digitsOnly
    : trimmedPhone.startsWith("00")
      ? digitsOnly.slice(2)
      : null;

  if (!normalizedInternationalPhone) {
    return null;
  }

  if (/^549\d{10}$/.test(normalizedInternationalPhone)) {
    return normalizedInternationalPhone;
  }

  if (/^54\d{10}$/.test(normalizedInternationalPhone)) {
    return `549${normalizedInternationalPhone.slice(2)}`;
  }

  return /^[1-9]\d{7,14}$/.test(normalizedInternationalPhone)
    ? normalizedInternationalPhone
    : null;
}

export function getWhatsAppSharePhoneState(phone: string | null) {
  const normalizedPhone = normalizePhoneForWhatsApp(phone);

  return {
    normalizedPhone,
    requiresPhoneInput: normalizedPhone === null,
  };
}

export function buildWhatsAppShareHref(input: {
  phone: string | null;
  text: string;
}) {
  const normalizedPhone = normalizePhoneForWhatsApp(input.phone);
  const encodedText = encodeURIComponent(input.text);

  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

export function formatShortQuotationNumber(quotationNumber: string) {
  const trimmedNumber = quotationNumber.trim();

  if (!trimmedNumber) {
    return "COT-#000";
  }

  const segments = trimmedNumber.split("-").filter(Boolean);

  if (segments.length >= 2) {
    const prefix = segments[0]?.toUpperCase() ?? "COT";
    const suffix = segments[segments.length - 1]?.toUpperCase() ?? "000";
    return `${prefix}-#${suffix}`;
  }

  return trimmedNumber.toUpperCase();
}

export type QuotationWhatsAppShareMessageInput = {
  clientName: string | null;
  businessName: string;
  quotationNumber: string;
  totalLabel: string;
  validUntilLabel: string;
  shareUrl: string;
};

export function buildQuotationWhatsAppShareMessage(
  input: QuotationWhatsAppShareMessageInput,
) {
  const trimmedClientName = input.clientName?.trim();
  const trimmedBusinessName = input.businessName.trim() || "Cotizapp";
  const shortNumber = formatShortQuotationNumber(input.quotationNumber);
  const greeting = trimmedClientName ? `Hola ${trimmedClientName}! 👋\n\n` : "";

  return `${greeting}Te comparto la cotización de ${trimmedBusinessName}:

📄 *${shortNumber}*
💰 Total: *${input.totalLabel}*
📅 Válida hasta: *${input.validUntilLabel}*

👉 Ver y descargar: ${input.shareUrl}

Cualquier consulta estoy disponible.
_${trimmedBusinessName}_`;
}
