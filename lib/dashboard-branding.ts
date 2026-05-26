import { getProfileLogoUploadState } from "@/app/actions/uploads";
import type { Profile } from "@/types";

type LogoState = Awaited<ReturnType<typeof getProfileLogoUploadState>>;
type ResolveLogoState = (logoPath: string | null) => Promise<LogoState>;

export type DashboardBranding = {
  businessName: string | null;
  logoUrl: string | null;
};

export async function resolveDashboardBranding(
  profile: Pick<Profile, "business_name" | "logo_url"> | null,
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

  const logoState = await resolveLogoState(logoPath);

  return {
    businessName,
    logoUrl: logoState?.previewUrl ?? null,
  };
}
