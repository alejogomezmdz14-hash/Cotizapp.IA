export function buildBusinessLogoPath(userId: string, fileName: string) {
  return `${userId}/logo/${fileName}`;
}

export function buildQuotationAttachmentPath(
  userId: string,
  quotationId: string,
  fileName: string,
) {
  return `${userId}/quotations/${quotationId}/${fileName}`;
}

export function buildInvoiceUploadPath(userId: string, fileName: string) {
  return `${userId}/invoices/${fileName}`;
}
