import type { Profile } from "@/types";

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

export function isClerkUserId(value: string) {
  return value.startsWith("user_");
}

export function remapStoragePathOwner(
  storagePath: string,
  fromOwnerId: string,
  toOwnerId: string,
) {
  if (!storagePath || fromOwnerId === toOwnerId) {
    return storagePath;
  }

  const prefix = `${fromOwnerId}/`;

  return storagePath.startsWith(prefix)
    ? `${toOwnerId}/${storagePath.slice(prefix.length)}`
    : storagePath;
}

export function resolveLogoStoragePath(
  logoPath: string | null,
  profile: Pick<Profile, "id" | "clerk_id"> | null,
) {
  const normalized = normalizeOptionalText(logoPath);

  if (!normalized || !profile?.clerk_id) {
    return normalized;
  }

  return remapStoragePathOwner(normalized, profile.clerk_id, profile.id);
}

/** Ruta canónica del logo en Storage (prefijo UUID del perfil). */
export function getCanonicalLogoStoragePath(
  logoPath: string | null,
  profile: Pick<Profile, "id" | "clerk_id"> | null,
) {
  return resolveLogoStoragePath(logoPath, profile);
}

/** Candidatos para leer el logo: UUID primero, legacy Clerk solo como fallback. */
export function getLogoStoragePathCandidates(
  logoPath: string | null,
  profile: Pick<Profile, "id" | "clerk_id"> | null,
) {
  const canonical = getCanonicalLogoStoragePath(logoPath, profile);
  const normalized = normalizeOptionalText(logoPath);

  if (!canonical) {
    return [];
  }

  if (!normalized || canonical === normalized) {
    return [canonical];
  }

  return Array.from(new Set([canonical, normalized]));
}
