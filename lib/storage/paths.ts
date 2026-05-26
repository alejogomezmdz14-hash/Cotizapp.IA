export function buildBusinessLogoPath(userId: string, fileName: string) {
  return `${userId}/logo/${fileName}`;
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

  const safeBaseName =
    baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "file";
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
