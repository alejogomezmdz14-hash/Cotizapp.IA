// components/dashboard/sparkline.tsx
import { buildSparklinePoints } from "@/lib/sparkline-points";
import { cn } from "@/lib/utils";

type SparklineProps = {
  values: number[];
  color: string;
  className?: string;
};

export function Sparkline({ values, color, className }: SparklineProps) {
  const points = buildSparklinePoints(values);

  if (!points) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className={cn("h-6 w-full", className)}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
