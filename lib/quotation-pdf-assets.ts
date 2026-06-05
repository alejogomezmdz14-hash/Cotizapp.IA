import { getLogoStoragePathCandidates } from "@/lib/storage/profile-paths";
import { downloadFile, STORAGE_BUCKETS } from "@/lib/storage/server";
import type { Profile } from "@/types";

export async function downloadProfileLogoForPdf(profile: Profile | null) {
  for (const path of getLogoStoragePathCandidates(profile?.logo_url ?? null, profile)) {
    try {
      const file = await downloadFile(STORAGE_BUCKETS.businessAssets, path);

      if (file) {
        return file;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function buildLogoDataUrlForPdf(profile: Profile | null) {
  const { buildProfileLogoDataUrl } = await import("@/lib/profile");
  const logoFile = await downloadProfileLogoForPdf(profile);
  return buildProfileLogoDataUrl(logoFile);
}

export { isStorageAccessError } from "@/lib/quotation-pdf-errors";
