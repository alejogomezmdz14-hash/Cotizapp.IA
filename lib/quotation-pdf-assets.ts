import { resolveLogoStoragePath } from "@/lib/storage/profile-paths";
import { downloadFile, STORAGE_BUCKETS } from "@/lib/storage/server";
import type { Profile } from "@/types";

function normalizeLogoPath(logoPath: string | null | undefined) {
  if (typeof logoPath !== "string") {
    return null;
  }

  const normalized = logoPath.trim();
  return normalized.length > 0 ? normalized : null;
}

function getLogoStoragePathCandidates(profile: Profile | null) {
  const storedPath = normalizeLogoPath(profile?.logo_url);

  if (!storedPath || !profile) {
    return [];
  }

  const remappedPath = resolveLogoStoragePath(storedPath, profile);

  return Array.from(new Set([remappedPath, storedPath].filter(Boolean))) as string[];
}

export async function downloadProfileLogoForPdf(profile: Profile | null) {
  for (const path of getLogoStoragePathCandidates(profile)) {
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
