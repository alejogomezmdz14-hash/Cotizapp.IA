/**
 * Compartir el PDF de una cotización como archivo usando la Web Share API.
 * En celulares abre el menú nativo (WhatsApp adjunta el PDF como documento).
 *
 * iOS exige que navigator.share() se llame inmediatamente después del toque
 * del usuario (sin awaits largos en el medio). Por eso el flujo es en dos
 * fases: `prepareQuotationPdfShare` descarga el PDF y arma el File, y
 * `presentQuotationPdfShare` abre el menú nativo sin ninguna espera previa.
 */

export type QuotationPdfShareOutcome = "shared" | "cancelled" | "blocked";

export type PreparedQuotationPdfShare = {
  file: File;
  title: string;
  text?: string;
};

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

/** Descarga el PDF y arma el archivo listo para compartir. Null si el
 * dispositivo no soporta compartir archivos. */
export async function prepareQuotationPdfShare(options: {
  pdfUrl: string;
  quotationNumber: string;
  clientName?: string | null;
  text?: string;
}): Promise<PreparedQuotationPdfShare | null> {
  if (!supportsQuotationPdfFileShare()) {
    return null;
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
    return null;
  }

  return {
    file,
    title: `Cotización ${options.quotationNumber}`,
    text: options.text,
  };
}

/** Abre el menú nativo de compartir. Llamar directo desde el tap del
 * usuario, sin awaits previos (requisito de iOS). */
export async function presentQuotationPdfShare(
  prepared: PreparedQuotationPdfShare,
): Promise<QuotationPdfShareOutcome> {
  try {
    await navigator.share({
      files: [prepared.file],
      title: prepared.title,
      text: prepared.text,
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
      // El permiso del gesto expiró: hace falta un toque nuevo del usuario.
      return "blocked";
    }

    throw shareError;
  }
}
