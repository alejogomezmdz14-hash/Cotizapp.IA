export function buildInvoiceScanImageDataUrl(
  bytes: Uint8Array,
  contentType: string | null,
  fileName?: string | null,
) {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  const mimeFromExtension =
    extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : extension === "jpg" || extension === "jpeg"
          ? "image/jpeg"
          : null;

  const mimeType = contentType?.trim() || mimeFromExtension || "image/jpeg";

  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}
