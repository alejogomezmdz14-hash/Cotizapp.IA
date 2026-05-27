const MEGABYTE_IN_BYTES = 1024 * 1024;

const IMAGE_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const LOGO_UPLOAD_MAX_BYTES = 5 * MEGABYTE_IN_BYTES;
export const INVOICE_UPLOAD_MAX_BYTES = 10 * MEGABYTE_IN_BYTES;
export const QUOTATION_ATTACHMENT_MAX_BYTES = 10 * MEGABYTE_IN_BYTES;

export class UploadActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadActionError";
    this.status = status;
  }
}

type ParsedLogoUpload = {
  file: File;
};

type ParsedInvoiceUpload = {
  file: File;
};

type ParsedQuotationAttachmentUpload = {
  quotationId: string;
  files: File[];
};

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function getTrimmedValue(formData: FormData, field: string) {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getQuotedSizeInMegabytes(bytes: number) {
  return `${Math.round(bytes / MEGABYTE_IN_BYTES)} MB`;
}

function assertFileWasSelected(file: FormDataEntryValue | null, message: string): File {
  if (!isFileEntry(file) || file.size <= 0) {
    throw new UploadActionError(message);
  }

  return file;
}

export function getUploadErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

export function isPreviewableAttachmentType(fileType: string | null) {
  if (!fileType) {
    return false;
  }

  return fileType.startsWith("image/") || fileType === "application/pdf";
}

export function parseLogoUploadFormData(formData: FormData): ParsedLogoUpload {
  const file = assertFileWasSelected(
    formData.get("file"),
    "Selecciona una imagen para continuar.",
  );

  if (!IMAGE_ALLOWED_TYPES.has(file.type)) {
    throw new UploadActionError("El logo debe ser una imagen PNG, JPG o WEBP.");
  }

  if (file.size > LOGO_UPLOAD_MAX_BYTES) {
    throw new UploadActionError(
      `El logo supera el tamaño máximo permitido de ${getQuotedSizeInMegabytes(
        LOGO_UPLOAD_MAX_BYTES,
      )}.`,
    );
  }

  return { file };
}

export function parseInvoiceUploadFormData(
  formData: FormData,
): ParsedInvoiceUpload {
  const file = assertFileWasSelected(
    formData.get("file"),
    "Selecciona una imagen de factura para continuar.",
  );

  if (!IMAGE_ALLOWED_TYPES.has(file.type)) {
    throw new UploadActionError(
      "La factura debe ser una imagen PNG, JPG o WEBP.",
    );
  }

  if (file.size > INVOICE_UPLOAD_MAX_BYTES) {
    throw new UploadActionError(
      `La factura supera el tamaño máximo permitido de ${getQuotedSizeInMegabytes(
        INVOICE_UPLOAD_MAX_BYTES,
      )}.`,
    );
  }

  return { file };
}

export function parseQuotationAttachmentUploadFormData(
  formData: FormData,
): ParsedQuotationAttachmentUpload {
  const quotationId = getTrimmedValue(formData, "quotationId");

  if (!quotationId) {
    throw new UploadActionError(
      "Guarda la cotización borrador antes de subir adjuntos.",
    );
  }

  const entries = formData.getAll("files");
  const fallbackFile = formData.get("file");
  const files = (entries.length > 0 ? entries : [fallbackFile]).filter(
    (entry): entry is File => isFileEntry(entry) && entry.size > 0,
  );

  if (files.length === 0) {
    throw new UploadActionError("Selecciona al menos un archivo para adjuntar.");
  }

  if (files.some((file) => file.size > QUOTATION_ATTACHMENT_MAX_BYTES)) {
    throw new UploadActionError(
      `Uno de los adjuntos supera el tamaño máximo permitido de ${getQuotedSizeInMegabytes(
        QUOTATION_ATTACHMENT_MAX_BYTES,
      )}.`,
    );
  }

  return {
    quotationId,
    files,
  };
}
