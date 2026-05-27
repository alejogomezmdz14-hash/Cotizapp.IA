import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type BusinessAvatarProps = {
  businessName: string | null;
  logoUrl: string | null;
  className?: string;
};

function getBusinessInitials(businessName: string | null) {
  const normalized = businessName?.trim();
  const segments = normalized ? normalized.split(/\s+/).filter(Boolean).slice(0, 2) : [];
  const initials = segments.map((segment) => segment[0]?.toUpperCase() ?? "").join("");
  return initials || "TN";
}

export function BusinessAvatar({
  businessName,
  logoUrl,
  className,
}: BusinessAvatarProps) {
  const initials = getBusinessInitials(businessName);

  return (
    <Avatar className={cn("h-10 w-10 shrink-0 border border-white/15", className)}>
      {logoUrl ? (
        <AvatarImage
          key={logoUrl}
          src={logoUrl}
          alt="Logo del negocio"
          className="bg-white object-contain p-1"
        />
      ) : null}
      <AvatarFallback className="bg-[#00E5A0] text-sm font-semibold text-black">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
