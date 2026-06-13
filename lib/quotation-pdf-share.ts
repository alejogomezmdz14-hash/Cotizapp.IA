/**
 * Compartir el PDF de una cotización como archivo usando la Web Share API.
 * En celulares abre el menú nativo (WhatsApp adjunta el PDF como documento).
 * En navegadores sin soporte se usa el fallback de wa.me con link público.
 */

export type QuotationPdfShareResult = "shared" | "cancelled" | "unsupported";

function buildPdfFileName(quotationNumber: string, clientName?: string | null) {
  const todayLabel = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date())
    .replace(/\//g, "-");
  const parts = ["Cotizacion", quotationNumber, clientName?.trim(), todayLabel]
    .filter((part): part is string => Boolean(part))
    .join(" ");

  // Sin caracteres problemáticos para nombres de archivo.
  return `${parts.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim()}.pdf`;
}

export function supportsQuotationPdfFileShare() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }

  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }

  try {
    const probeFile = new File(["probe"], "cotizacion.pdf", {
      type: "application/pdf",
    });
    return navigator.canShare({ files: [probeFile] });
  } catch {
    return false;
  }
}

export async function shareQuotationPdfFile(options: {
  pdfUrl: string;
  quotationNumber: string;
  clientName?: string | null;
  text?: string;
}): Promise<QuotationPdfShareResult> {
  if (!supportsQuotationPdfFileShare()) {
    return "unsupported";
  }

  const response = await fetch(options.pdfUrl);

  if (!response.ok) {
    throw new Error("No se pudo descargar el PDF para compartir.");
  }

  const blob = await response.blob();
  const file = new File(
    [blob],
    buildPdfFileName(options.quotationNumber, options.clientName),
    {
      type: "application/pdf",
    },
  );

  if (!navigator.canShare({ files: [file] })) {
    return "unsupported";
  }

  try {
    await navigator.share({
      files: [file],
      title: `Cotización ${options.quotationNumber}`,
      text: options.text,
    });
    return "shared";
  } catch (shareError) {
    if (shareError instanceof DOMException && shareError.name === "AbortError") {
      return "cancelled";
    }

    if (
      shareError instanceof DOMException &&
      shareError.name === "NotAllowedError"
    ) {
      // El permiso del gesto expiró (ej. PDF lento de generar): fallback.
      return "unsupported";
    }

    throw shareError;
  }
}
