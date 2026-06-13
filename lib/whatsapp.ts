type CountryCodeRule = {
  code: string;
  nationalLength: number;
  buildInternational: (digits: string) => string;
};

const LATAM_COUNTRY_RULES: CountryCodeRule[] = [
  { code: "54", nationalLength: 10, buildInternational: (digits) => `549${digits}` },
  { code: "56", nationalLength: 9, buildInternational: (digits) => `56${digits}` },
  { code: "52", nationalLength: 10, buildInternational: (digits) => `52${digits}` },
  { code: "57", nationalLength: 10, buildInternational: (digits) => `57${digits}` },
  { code: "51", nationalLength: 9, buildInternational: (digits) => `51${digits}` },
  { code: "598", nationalLength: 8, buildInternational: (digits) => `598${digits}` },
  { code: "591", nationalLength: 8, buildInternational: (digits) => `591${digits}` },
  { code: "595", nationalLength: 9, buildInternational: (digits) => `595${digits}` },
  { code: "593", nationalLength: 9, buildInternational: (digits) => `593${digits}` },
];

function normalizeInternationalDigits(digits: string) {
  if (/^549\d{10}$/.test(digits)) {
    return digits;
  }

  if (/^54\d{10}$/.test(digits)) {
    return `549${digits.slice(2)}`;
  }

  for (const rule of LATAM_COUNTRY_RULES) {
    if (digits.startsWith(rule.code)) {
      const expectedLength = rule.code.length + rule.nationalLength;

      if (digits.length === expectedLength) {
        return digits;
      }
    }
  }

  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function normalizePhoneForWhatsApp(phone: string | null) {
  if (!phone) {
    return null;
  }

  const trimmedPhone = phone.trim();
  const digitsOnly = trimmedPhone.replace(/\D+/g, "");

  if (!digitsOnly) {
    return null;
  }

  const isExplicitInternational =
    trimmedPhone.startsWith("+") || trimmedPhone.startsWith("00");

  if (isExplicitInternational) {
    const stripped = trimmedPhone.startsWith("+")
      ? digitsOnly
      : digitsOnly.slice(2);
    return normalizeInternationalDigits(stripped);
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

  if (/^\d{9}$/.test(digitsOnly)) {
    return `549${digitsOnly.slice(-9)}`;
  }

  return normalizeInternationalDigits(digitsOnly);
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
  /** Si no se pasa, el mensaje no incluye link (el PDF viaja adjunto). */
  shareUrl?: string | null;
};

export function buildQuotationWhatsAppShareMessage(
  input: QuotationWhatsAppShareMessageInput,
) {
  const trimmedClientName = input.clientName?.trim();
  const trimmedBusinessName = input.businessName.trim() || "Cotizapp";
  const shortNumber = formatShortQuotationNumber(input.quotationNumber);
  const greeting = trimmedClientName ? `Hola ${trimmedClientName}! 👋\n\n` : "";
  const shareLine = input.shareUrl
    ? `\n👉 Ver y descargar: ${input.shareUrl}\n`
    : "";

  return `${greeting}Te comparto la cotización de ${trimmedBusinessName}:

📄 *${shortNumber}*
💰 Total: *${input.totalLabel}*
📅 Válida hasta: *${input.validUntilLabel}*
${shareLine}
Cualquier consulta estoy disponible.
_${trimmedBusinessName}_`;
}
