import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { createClient } from "@/lib/supabase/server";

type UploadFileInput = {
  bucket: string;
  path: string;
  body: ArrayBuffer | Uint8Array | Buffer;
  contentType?: string;
  upsert?: boolean;
};

export async function createSignedFileUrl(bucket: string, path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 10);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function uploadFile({
  bucket,
  path,
  body,
  contentType,
  upsert = false,
}: UploadFileInput) {
  const supabase = await createClient();
  const normalizedBody =
    body instanceof ArrayBuffer ? Buffer.from(body) : Buffer.from(body);
  const { error } = await supabase.storage.from(bucket).upload(path, normalizedBody, {
    contentType,
    upsert,
  });

  if (error) {
    console.error("[storage][upload] failed", { bucket, path, message: error.message });
    throw error;
  }

  console.info("[storage][upload] ok", { bucket, path, bytes: normalizedBody.length });
}

export async function downloadFile(bucket: string, path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) {
    console.error("[storage][download] failed", { bucket, path, message: error.message });
    throw error;
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  console.info("[storage][download] ok", { bucket, path, bytes: bytes.length });

  return {
    bytes,
    contentType: data.type || null,
  };
}

export async function removeFile(bucket: string, path: string) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw error;
  }
}

export { STORAGE_BUCKETS };
