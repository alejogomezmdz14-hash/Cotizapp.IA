import Image from "next/image";

import { COTIZAPP_ICON } from "@/lib/brand/assets";
import { cn } from "@/lib/utils";

type CotizappIconProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

export function CotizappIcon({
  className,
  size = 40,
  priority = false,
}: CotizappIconProps) {
  return (
    <Image
      src={COTIZAPP_ICON}
      alt="Cotizapp"
      width={size}
      height={size}
      className={cn("bg-transparent object-contain", className)}
      priority={priority}
    />
  );
}
