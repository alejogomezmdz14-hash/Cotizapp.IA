"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import {
  deleteQuotationAction,
  duplicateQuotationAction,
  generateQuotationPdfAction,
  toggleQuotationPaidAction,
  updateQuotationStatusAction,
} from "@/app/actions/quotations";
import { buildPublicAppPath } from "@/lib/app-url";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast-provider";

const statusOptions = [
  { value: "draft", label: "Borrador" },
  { value: "pending", label: "Enviada" },
  { value: "accepted", label: "Aceptada" },
  { value: "rejected", label: "Rechazada" },
] as const;

type QuotationMoreMenuProps = {
  quotationId: string;
  quotationNumber: string;
  initialStatus: string | null;
  paidAt: string | null;
  pdfGeneratedAt?: string | null;
  shareToken?: string | null;
  reopenHref?: string | null;
  showSecondaryPdfActions?: boolean;
};

export function QuotationMoreMenu({
  quotationId,
  quotationNumber,
  initialStatus,
  paidAt,
  pdfGeneratedAt = null,
  shareToken = null,
  reopenHref,
  showSecondaryPdfActions = false,
}: QuotationMoreMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isPaid = Boolean(paidAt);
  const pdfUrl = `/api/quotations/${encodeURIComponent(quotationId)}/pdf`;
  const pdfDownloadUrl = `${pdfUrl}?download=1`;
  const publicShareUrl = shareToken
    ? buildPublicAppPath(`/api/quotations/share/${encodeURIComponent(shareToken)}`)
    : null;

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
      router.refresh();
    } catch (error) {
      toast({
        title: "No se pudo completar la acción",
        description:
          error instanceof Error ? error.message : "Intentá de nuevo.",
        variant: "error",
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="bg-background/75"
            disabled={isBusy}
            aria-label="Más acciones"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {showSecondaryPdfActions ? (
            <>
              <DropdownMenuItem
                onClick={() =>
                  void runAction(async () => {
                    await generateQuotationPdfAction(quotationId);
                    toast({
                      title: "PDF generado",
                      description: "Ya podés verlo o descargarlo.",
                    });
                  })
                }
              >
                <FileText className="mr-2 h-4 w-4" />
                {pdfGeneratedAt ? "Actualizar PDF" : "Generar PDF"}
              </DropdownMenuItem>

              {pdfGeneratedAt ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={pdfUrl} target="_blank">
                      <FileText className="mr-2 h-4 w-4" />
                      Ver PDF
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={pdfDownloadUrl} download>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar PDF
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}

              {publicShareUrl ? (
                <DropdownMenuItem asChild>
                  <Link href={publicShareUrl} target="_blank" rel="noreferrer">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar enlace
                  </Link>
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />
            </>
          ) : (
            <DropdownMenuItem asChild>
              <Link href={pdfUrl} target="_blank">
                <Download className="mr-2 h-4 w-4" />
                Ver / Descargar PDF
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() =>
              void runAction(async () => {
                const result = await duplicateQuotationAction(quotationId);
                router.push(`/cotizaciones/nueva?quotationId=${result.quotationId}`);
              })
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicar cotización
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileText className="mr-2 h-4 w-4" />
              Cambiar estado
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  disabled={option.value === (initialStatus ?? "draft")}
                  onClick={() =>
                    void runAction(async () => {
                      await updateQuotationStatusAction(
                        quotationId,
                        option.value,
                      );
                      toast({
                        title: "Estado actualizado",
                        description: `La cotización pasó a ${option.label}.`,
                      });
                    })
                  }
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            onClick={() =>
              void runAction(async () => {
                await toggleQuotationPaidAction(quotationId, !isPaid);
                toast({
                  title: isPaid ? "Marcada como no pagada" : "Marcada como pagada",
                  description: isPaid
                    ? "Quitamos el estado de pago."
                    : "La cotización figura como pagada.",
                });
              })
            }
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isPaid ? "Marcar como no pagada" : "Marcar como pagada"}
          </DropdownMenuItem>

          {reopenHref ? (
            <DropdownMenuItem asChild>
              <Link href={reopenHref}>Reabrir borrador</Link>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem asChild>
            <Link href={`/cotizaciones/${quotationId}`}>Ver detalle</Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Eliminar cotización"
        description={`¿Eliminar la cotización ${quotationNumber}? Se borrarán adjuntos y PDFs asociados.`}
        confirmLabel="Eliminar"
        isLoading={isBusy}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() =>
          void runAction(async () => {
            await deleteQuotationAction(quotationId);
            setShowDeleteConfirm(false);
            toast({
              title: "Cotización eliminada",
              description: "Ya no figura en tu historial.",
            });
            router.push("/cotizaciones");
          })
        }
      />
    </>
  );
}
