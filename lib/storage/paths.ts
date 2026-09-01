export function buildBusinessLogoPath(userId: string, fileName: string) {
  return `${userId}/logo/${fileName}`;
}

export function buildUserAvatarPath(userId: string, fileName: string) {
  return `${userId}/avatar/${buildUniqueStorageFileName(fileName)}`;
}

function sanitizeStorageSegment(value: string, fallback: string) {
  const normalizedValue = value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");

  return (
    normalizedValue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

function buildUniqueStorageFileName(
  fileName: string,
  objectId = globalThis.crypto.randomUUID(),
) {
  const originalName = fileName.split(/[\\/]/).pop() ?? "file";
  const normalizedName = originalName.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  const extensionIndex = normalizedName.lastIndexOf(".");
  const baseName =
    extensionIndex > 0
      ? normalizedName.slice(0, extensionIndex)
      : normalizedName;
  const extension =
    extensionIndex > 0
      ? normalizedName.slice(extensionIndex + 1).toLowerCase()
      : "";

  const safeBaseName = sanitizeStorageSegment(baseName, "file");
  const safeExtension = extension.replace(/[^a-z0-9]+/g, "");
  const safeObjectId = objectId.toLowerCase();

  if (!safeExtension) {
    return `${safeBaseName}-${safeObjectId}`;
  }

  return `${safeBaseName}-${safeObjectId}.${safeExtension}`;
}

export function buildQuotationAttachmentPath(
  userId: string,
  quotationId: string,
  fileName: string,
  objectId?: string,
) {
  return `${userId}/quotations/${quotationId}/${buildUniqueStorageFileName(
    fileName,
    objectId,
  )}`;
}

export function buildInvoiceUploadPath(
  userId: string,
  fileName: string,
  objectId?: string,
) {
  return `${userId}/invoices/${buildUniqueStorageFileName(fileName, objectId)}`;
}

export function buildExpenseReceiptPath(
  userId: string,
  fileName: string,
  objectId?: string,
) {
  return `${userId}/receipts/${buildUniqueStorageFileName(fileName, objectId)}`;
}

// El escaneo de recibos recibe la ruta desde el navegador, así que se valida en
// el servidor. Chequear solo que empiece con el id del usuario deja pasar
// `<id>/../otro-usuario/recibo.png`: hoy Supabase Storage trata la clave como un
// nombre literal y no resuelve `..`, pero eso es una garantía del proveedor, no
// nuestra. Acá exigimos la forma exacta que produce buildExpenseReceiptPath, así
// que no dependemos de cómo interprete la ruta quien esté del otro lado.
//
// El nombre de archivo que arma buildUniqueStorageFileName ya viene pasado por
// sanitizeStorageSegment: minúsculas, solo [a-z0-9-], y una única extensión
// opcional. Cualquier barra, punto doble o mayúscula significa que la ruta no la
// generamos nosotros.
const EXPENSE_RECEIPT_FILE_NAME = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9]+)?$/;

export function isExpenseReceiptPathForUser(userId: string, path: string) {
  if (!userId || !path) {
    return false;
  }

  const prefix = `${userId}/receipts/`;

  if (!path.startsWith(prefix)) {
    return false;
  }

  return EXPENSE_RECEIPT_FILE_NAME.test(path.slice(prefix.length));
}

export function buildQuotationSignaturePath(
  userId: string,
  quotationId: string,
  fileName: string,
  objectId?: string,
) {
  return `${userId}/quotations/${quotationId}/${buildUniqueStorageFileName(
    fileName,
    objectId,
  )}`;
}

export function buildQuotationPdfFileName(quotationNumber: string) {
  return `${sanitizeStorageSegment(quotationNumber, "cotizacion")}.pdf`;
}

export function buildQuotationPdfPath(
  userId: string,
  quotationId: string,
  quotationNumber: string,
) {
  return `${userId}/quotation-pdfs/${quotationId}/${buildQuotationPdfFileName(
    quotationNumber,
  )}`;
}

export function buildSharedQuotationPdfPath(userId: string, shareToken: string) {
  return `${userId}/quotation-share-pdfs/${sanitizeStorageSegment(
    shareToken,
    "cotizacion-compartida",
  )}.pdf`;
}
