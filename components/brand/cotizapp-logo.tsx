"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

type CotizappLogoProps = {
  className?: string;
  width?: number;
  priority?: boolean;
  variant?: "auto" | "on-dark" | "on-light";
};

export function CotizappLogo({
  className,
  width = 160,
  priority = false,
  variant = "auto",
}: CotizappLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolvedVariant =
    variant === "auto"
      ? mounted && resolvedTheme === "light"
        ? "on-light"
        : "on-dark"
      : variant;

  const src =
    resolvedVariant === "on-light"
      ? "/cotizapp-logo-light.png"
      : "/cotizapp-logo.png";

  return (
    <Image
      src={src}
      alt="Cotizapp"
      width={width}
      height={Math.round(width * 0.3)}
      className={cn("h-auto max-w-full bg-transparent object-contain", className)}
      style={{ width }}
      priority={priority}
    />
  );
}
