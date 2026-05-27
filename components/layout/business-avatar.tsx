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
  const displayName = businessName?.trim() || "Tu negocio";
  const initials = getBusinessInitials(businessName);

  return (
    <div className={cn("group relative inline-flex shrink-0", className)}>
      <div
        className="h-9 w-9 overflow-hidden rounded-full"
        aria-label={displayName}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logoUrl}
            src={logoUrl}
            alt={`Logo de ${displayName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#00E5A0] text-sm font-bold text-black">
            {initials}
          </div>
        )}
      </div>

      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111318] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {displayName}
        <span
          aria-hidden
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#111318]"
        />
      </span>
    </div>
  );
}
