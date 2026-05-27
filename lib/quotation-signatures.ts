import {
  createSignedFileUrl,
  STORAGE_BUCKETS,
} from "@/lib/storage/server";

export async function getQuotationSignaturePreviewUrl(
  signaturePath: string | null | undefined,
) {
  const normalizedPath = signaturePath?.trim();

  if (!normalizedPath) {
    return null;
  }

  try {
    return await createSignedFileUrl(
      STORAGE_BUCKETS.quotationSignatures,
      normalizedPath,
    );
  } catch {
    return null;
  }
}
