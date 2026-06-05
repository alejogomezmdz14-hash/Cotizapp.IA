import { getProfileLogoUploadState } from "@/app/actions/uploads";
import type { Profile } from "@/types";

type LogoState = Awaited<ReturnType<typeof getProfileLogoUploadState>>;
type ResolveLogoState = (
  logoPath: string | null,
  profile?: Pick<Profile, "business_name" | "logo_url" | "id" | "clerk_id"> | null,
) => Promise<LogoState>;

export type DashboardBranding = {
  businessName: string | null;
  logoUrl: string | null;
};

export async function resolveDashboardBranding(
  profile: Pick<Profile, "business_name" | "logo_url" | "id" | "clerk_id"> | null,
  resolveLogoState: ResolveLogoState = getProfileLogoUploadState,
): Promise<DashboardBranding> {
  const businessName = profile?.business_name ?? null;
  const logoPath = profile?.logo_url ?? null;

  if (!logoPath) {
    return {
      businessName,
      logoUrl: null,
    };
  }

  const logoState = await resolveLogoState(logoPath, profile);

  return {
    businessName,
    logoUrl: logoState?.previewUrl ?? null,
  };
}
