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
