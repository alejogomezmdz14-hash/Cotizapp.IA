"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";

import { QuotationDuplicateButton } from "@/components/cotizacion/quotation-duplicate-button";
import { QuotationMoreMenu } from "@/components/cotizacion/quotation-more-menu";
import { QuotationShareActions } from "@/components/cotizacion/quotation-share-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrencyAmount, formatDateOnly, formatDateTime } from "@/lib/formatting";
import { formatDisplayName } from "@/lib/entity-normalization";
import { isQuotationPastValidity } from "@/lib/quotation-expiry";
import { sanitizeQuotationValidityDate } from "@/lib/quotation-validity";
import { getDraftQuotationEditorHref } from "@/lib/quotation-editor-links";
import { isDraftQuotationStatus } from "@/lib/quotation-status";
import { cn } from "@/lib/utils";
import type { Quotation } from "@/types";

type QuotationsListProps = {
  quotations: Quotation[];
  currency: string | null;
};

type StatusFilter = "all" | "draft" | "pending" | "accepted" | "rejected";

const statusFilters: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "draft", label: "Borrador" },
  { id: "pending", label: "Enviada" },
  { id: "accepted", label: "Aceptada" },
  { id: "rejected", label: "Rechazada" },
];

function formatStatusLabel(value: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "draft":
      return "Borrador";
    case "pending":
      return "Enviada";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    default:
      return "Sin estado";
  }
}

function getStatusBadgeClassName(value: string | null) {
  switch (value?.trim().toLowerCase()) {
    case "accepted":
      return "border-primary/40 bg-primary/10 text-primary";
    case "rejected":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "pending":
      return "border-token bg-surface-2 text-foreground";
    default:
      return "border-token bg-background text-foreground";
  }
}

export function QuotationsList({ quotations, currency }: QuotationsListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">(
    quotations.length > 10 ? "table" : "cards",
  );

  const filteredQuotations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return quotations.filter((quotation) => {
      const matchesStatus =
        statusFilter === "all" || quotation.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const clientName = formatDisplayName(quotation.client_name).toLowerCase();
      const number = quotation.number.toLowerCase();

      return (
        clientName.includes(normalizedSearch) || number.includes(normalizedSearch)
      );
    });
  }, [quotations, searchQuery, statusFilter]);

  const summaryCardClassName =
    "!rounded-[1.75rem] !border-token !bg-background/75 !shadow-[0_20px_45px_-32px_rgba(15,17,23,0.45)]";

  if (quotations.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-token bg-background/60 px-5 py-10 text-center">
        <p className="text-lg font-semibold text-foreground">
          Todavía no creaste cotizaciones
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <Link href="/cotizaciones/nueva">Ir a nueva cotización</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por cliente o número..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "cards" ? "default" : "outline"}
            onClick={() => setViewMode("cards")}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" />
            Tarjetas
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "table" ? "default" : "outline"}
            onClick={() => setViewMode("table")}
          >
            <List className="mr-1.5 h-4 w-4" />
            Tabla
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatusFilter(filter.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              statusFilter === filter.id
                ? "border-[rgb(var(--accent-rgb)/0.35)] bg-[rgb(var(--accent-rgb)/0.12)] text-foreground"
                : "border-token/80 bg-background/70 text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredQuotations.length === 0 ? (
        <p className="rounded-[1.5rem] border border-dashed border-token px-4 py-8 text-center text-sm text-muted-foreground">
          No hay cotizaciones que coincidan con el filtro.
        </p>
      ) : viewMode === "table" ? (
        <div className="overflow-x-auto rounded-[1.75rem] border border-token bg-background/70">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-token/80 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotations.map((quotation) => {
                const isExpired = isQuotationPastValidity(quotation.valid_until);
                const detailHref = `/cotizaciones/${quotation.id}`;

                return (
                  <tr
                    key={quotation.id}
                    className={cn(
                      "border-b border-token/50 transition hover:bg-background/90",
                      isExpired && "bg-destructive/5",
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link href={detailHref} className="font-medium hover:text-primary">
                        {quotation.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={detailHref} className="hover:text-primary">
                        {formatDisplayName(quotation.client_name) || "Cliente sin asignar"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(quotation.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrencyAmount(quotation.total, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${getStatusBadgeClassName(quotation.status)}`}
                        >
                          {formatStatusLabel(quotation.status)}
                        </span>
                        {isExpired ? (
                          <span className="rounded-full border border-destructive/50 bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                            Vencida
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <QuotationDuplicateButton quotationId={quotation.id} />
                        <Button asChild size="sm" variant="outline">
                          <Link href={detailHref}>Ver</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredQuotations.map((quotation) => {
            const reopenDraftHref = getDraftQuotationEditorHref(quotation);
            const canShareQuotation =
              isDraftQuotationStatus(quotation.status) ||
              quotation.status === "pending";
            const isExpired = isQuotationPastValidity(quotation.valid_until);
            const detailHref = `/cotizaciones/${quotation.id}`;

            return (
              <Link
                key={quotation.id}
                href={detailHref}
                className={cn(
                  summaryCardClassName,
                  "block rounded-[1.75rem] border p-5 transition hover:border-[rgb(var(--accent-rgb)/0.28)]",
                  isExpired && "!border-destructive/50 !bg-destructive/5",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {quotation.number}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadgeClassName(quotation.status)}`}
                      >
                        {formatStatusLabel(quotation.status)}
                      </span>
                      {isExpired ? (
                        <span className="rounded-full border border-destructive/50 bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
                          Vencida
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-foreground">
                        {formatDisplayName(quotation.client_name) || "Cliente sin asignar"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Creada el {formatDateTime(quotation.created_at)} · Válida hasta{" "}
                        {formatDateOnly(sanitizeQuotationValidityDate(quotation.valid_until))}
                      </p>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatCurrencyAmount(quotation.total, currency)}
                    </p>
                  </div>
                </div>

                {canShareQuotation ? (
                  <div
                    className="mt-4"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <QuotationShareActions
                      quotationId={quotation.id}
                      quotationNumber={quotation.number}
                      initialPdfGeneratedAt={quotation.pdf_generated_at}
                      initialShareToken={quotation.share_token}
                      initialSentAt={quotation.sent_at}
                      initialStatus={quotation.status}
                    />
                  </div>
                ) : null}

                <div
                  className="mt-4 flex flex-wrap justify-end gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <QuotationDuplicateButton quotationId={quotation.id} />
                  <QuotationMoreMenu
                    quotationId={quotation.id}
                    quotationNumber={quotation.number}
                    initialStatus={quotation.status}
                    paidAt={quotation.paid_at ?? null}
                    reopenHref={reopenDraftHref}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
