"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type NotificationToggleProps = {
  label: string;
  description: string;
};

function NotificationToggle({ label, description }: NotificationToggleProps) {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-token/70 bg-background/80 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled
        title="Próximamente"
        onClick={() => setEnabled((current) => !current)}
        className={cn(
          "relative inline-flex h-8 w-14 shrink-0 cursor-not-allowed items-center rounded-full border opacity-60 transition",
          enabled
            ? "border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.2)]"
            : "border-token bg-muted",
        )}
      >
        <span
          className={cn(
            "inline-flex h-6 w-6 translate-x-1 rounded-full bg-background shadow-sm transition",
            enabled && "translate-x-7",
          )}
        />
      </button>
    </div>
  );
}

export function NotificationSettingsPanel() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Próximamente
      </p>
      <NotificationToggle
        label="Recordatorios de cotizaciones pendientes"
        description="Avisos cuando una cotización lleva días sin respuesta."
      />
      <NotificationToggle
        label="Resumen semanal"
        description="Un email con el estado de tus cotizaciones cada semana."
      />
    </div>
  );
}
