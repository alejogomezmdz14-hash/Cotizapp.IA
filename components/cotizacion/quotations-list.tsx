"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Search } from "lucide-react";

import { QuotationMoreMenu } from "@/components/cotizacion/quotation-more-menu";
import { QuotationShareActions } from "@/components/cotizacion/quotation-share-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrencyAmount } from "@/lib/formatting";
import { formatDisplayName } from "@/lib/entity-normalization";
import { shouldDisplayQuotationAsExpired } from "@/lib/quotation-expiry";
import { sanitizeQuotationValidityDate } from "@/lib/quotation-validity";
import { getDraftQuotationEditorHref } from "@/lib/quotation-editor-links";
import {
  formatQuotationStatusLabel,
  getQuotationStatusBadgeClassName,
  isDraftQuotationStatus,
} from "@/lib/quotation-status";
import { cn } from "@/lib/utils";
import type { Quotation } from "@/types";

type QuotationsListProps = {
  quotations: Quotation[];
  currency: string | null;
};

type StatusFilter = "all" | "draft" | "pending" | "accepted" | "rejected";

function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

const statusFilters: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "draft", label: "Borrador" },
  { id: "pending", label: "Enviada" },
  { id: "accepted", label: "Aceptada" },
  { id: "rejected", label: "Rechazada" },
];

export function QuotationsList({ quotations, currency }: QuotationsListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const showTable = viewMode === "table";

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

  const summaryCardClassName = "!rounded-md !border-token !bg-background/75 !shadow-none";

  if (quotations.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-token bg-background/60 px-5 py-10 text-center">
        <p className="text-lg font-semibold text-foreground">
          Todavía no creaste cotizaciones
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Armá la primera en menos de un minuto.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild className="min-h-12">
            <Link href="/cotizaciones/nueva">Crear mi primera cotización</Link>
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
        <div className="hidden items-center gap-2 lg:flex">
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
              "min-h-11 rounded-full border px-4 text-sm font-medium transition active:scale-[0.97]",
              statusFilter === filter.id
                ? "border-[rgb(var(--accent-rgb)/0.45)] bg-[rgb(var(--accent-rgb)/0.14)] text-foreground"
                : "border-token/80 bg-background/70 text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredQuotations.length === 0 ? (
        <p className="rounded-md border border-dashed border-token px-4 py-8 text-center text-sm text-muted-foreground">
          No hay cotizaciones que coincidan con el filtro.
        </p>
      ) : (
        <>
          {showTable ? (
            <div className="hidden overflow-x-auto rounded-md border border-token bg-background/70 lg:block">
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
                    const isExpired = shouldDisplayQuotationAsExpired(
                      quotation.valid_until,
                      quotation.status,
                    );
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
                          Creada {formatShortDate(quotation.created_at)} — Vence{" "}
                          {formatShortDate(quotation.valid_until)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatCurrencyAmount(quotation.total, currency)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs ${getQuotationStatusBadgeClassName(quotation.status)}`}
                            >
                              {formatQuotationStatusLabel(quotation.status)}
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
                            <QuotationMoreMenu
                              quotationId={quotation.id}
                              quotationNumber={quotation.number}
                              initialStatus={quotation.status}
                              paidAt={quotation.paid_at ?? null}
                              pdfGeneratedAt={quotation.pdf_generated_at}
                              shareToken={quotation.share_token}
                              showSecondaryPdfActions
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className={cn("grid gap-4", showTable && "lg:hidden")}>
          {filteredQuotations.map((quotation) => {
            const reopenDraftHref = getDraftQuotationEditorHref(quotation);
            const isDraft = isDraftQuotationStatus(quotation.status);
            const isExpired = shouldDisplayQuotationAsExpired(
              quotation.valid_until,
              quotation.status,
            );
            const detailHref = `/cotizaciones/${quotation.id}`;

            return (
              <Link
                key={quotation.id}
                href={detailHref}
                className={cn(
                  summaryCardClassName,
              "block rounded-md border p-5 transition hover:border-[rgb(var(--accent-rgb)/0.28)]",
                  isExpired && "!border-destructive/50 !bg-destructive/5",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getQuotationStatusBadgeClassName(quotation.status)}`}
                      >
                        {formatQuotationStatusLabel(quotation.status)}
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
                        {quotation.number}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Creada {formatShortDate(quotation.created_at)} — Vence{" "}
                        {formatShortDate(sanitizeQuotationValidityDate(quotation.valid_until))}
                      </p>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatCurrencyAmount(quotation.total, currency)}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 flex items-center gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <QuotationShareActions
                    quotationId={quotation.id}
                    quotationNumber={quotation.number}
                    initialPdfGeneratedAt={quotation.pdf_generated_at}
                    initialShareToken={quotation.share_token}
                    initialSentAt={quotation.sent_at}
                    initialStatus={quotation.status}
                    isDraft={isDraft}
                    variant="listPrimary"
                  />
                  <QuotationMoreMenu
                    quotationId={quotation.id}
                    quotationNumber={quotation.number}
                    initialStatus={quotation.status}
                    paidAt={quotation.paid_at ?? null}
                    pdfGeneratedAt={quotation.pdf_generated_at}
                    shareToken={quotation.share_token}
                    reopenHref={reopenDraftHref}
                    showSecondaryPdfActions
                  />
                </div>
              </Link>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
