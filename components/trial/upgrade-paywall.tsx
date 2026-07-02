"use client";

import { MessageCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UPGRADE_WHATSAPP } from "@/lib/trial";

type UpgradePaywallReason = "quotations" | "invoices";

type UpgradePaywallProps = {
  reason?: UpgradePaywallReason;
};

const REASON_COPY: Record<UpgradePaywallReason, string> = {
  quotations:
    "Llegaste al límite de cotizaciones del trial gratis. Pasá a Pro para seguir cotizando sin tope.",
  invoices:
    "Llegaste al límite de escaneos de factura del trial gratis. Pasá a Pro para seguir escaneando sin tope.",
};

export function UpgradePaywall({ reason }: UpgradePaywallProps) {
  const detail = reason
    ? REASON_COPY[reason]
    : "Llegaste al límite del trial gratis. Pasá a Pro para seguir.";

  return (
    <div className="rounded-[1.5rem] border border-[rgb(var(--accent-rgb)/0.3)] bg-[rgb(var(--accent-rgb)/0.08)] px-5 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-token/80 bg-background p-2 text-accent-token">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">
              Pasá a Pro para seguir
            </p>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              {detail} Te activamos la cuenta al toque por WhatsApp.
            </p>
          </div>
        </div>

        <Button asChild className="min-h-12 shrink-0">
          <a href={UPGRADE_WHATSAPP} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" />
            Pasar a Pro por WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
