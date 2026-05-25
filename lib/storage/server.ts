import { STORAGE_BUCKETS } from "@/lib/storage/buckets";
import { createClient } from "@/lib/supabase/server";

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

export async function removeFile(bucket: string, path: string) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw error;
  }
}

export { STORAGE_BUCKETS };
