// components/dashboard/dashboard-status-donut.tsx
import { buildConicGradient } from "@/lib/donut-gradient";
import type { QuotationStatusCounts } from "@/lib/dashboard-status-counts";
import type { DashboardPeriod } from "@/lib/dashboard-period";

type DashboardStatusDonutProps = {
  counts: QuotationStatusCounts;
  period: DashboardPeriod;
};

// Solo estados ALMACENADOS. "Vencida" es un estado derivado de la fecha de
// validez (no vive en la columna `status`), por eso no se incluye acá; el
// donut refleja el resultado real de las cotizaciones (Aceptada/Enviada/Rechazada).
const SEGMENTS: { key: keyof QuotationStatusCounts; label: string; color: string }[] = [
  { key: "accepted", label: "Aceptadas", color: "#00E5A0" },
  { key: "pending", label: "Enviadas", color: "#58a6ff" },
  { key: "rejected", label: "Rechazadas", color: "#f85149" },
];

export function DashboardStatusDonut({ counts, period }: DashboardStatusDonutProps) {
  const visible = SEGMENTS.filter((segment) => counts[segment.key] > 0);
  // Total de lo que realmente se grafica (no incluye borradores ni otros estados
  // que no se muestran), para que el número del centro coincida con la leyenda.
  const visibleTotal = visible.reduce((sum, segment) => sum + counts[segment.key], 0);
  const gradient = buildConicGradient(
    visible.map((segment) => ({ value: counts[segment.key], color: segment.color })),
  );

  return (
    <section className="shell-panel overflow-hidden px-4 py-5 sm:px-6 sm:py-6">
      <h3 className="mb-4 text-base font-semibold tracking-tight text-foreground">
        Estados de tus cotizaciones
      </h3>

      {visibleTotal === 0 ? (
        <p className="rounded-md border border-dashed border-token bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Sin cotizaciones {period === "week" ? "esta semana" : "este mes"}.
        </p>
      ) : (
        <div className="flex items-center gap-5">
          <div
            className="relative h-28 w-28 shrink-0 rounded-full"
            style={{ background: gradient }}
            role="img"
            aria-label={`Estados: ${visible
              .map((segment) => `${segment.label} ${counts[segment.key]}`)
              .join(", ")}`}
          >
            <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-background">
              <span className="text-xl font-bold text-foreground">{visibleTotal}</span>
              <span className="text-[10px] text-muted-foreground">total</span>
            </div>
          </div>

          <ul className="flex-1 space-y-2 text-sm">
            {SEGMENTS.map((segment) => (
              <li key={segment.key} className="flex items-center gap-2 text-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: segment.color }}
                />
                <span className="text-muted-foreground">{segment.label}</span>
                <span className="ml-auto font-semibold">{counts[segment.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
