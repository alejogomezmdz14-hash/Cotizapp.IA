"use client";

import { useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";

import {
  confirmQuotationWhatsappShareAction,
  generateQuotationPdfAction,
  getQuotationWhatsappRecipientAction,
  saveQuotationClientPhoneAction,
} from "@/app/actions/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import { buildPublicAppPath } from "@/lib/app-url";
import { formatDateTime } from "@/lib/formatting";
import {
  prepareQuotationPdfShare,
  presentQuotationPdfShare,
  supportsQuotationPdfFileShare,
  type PreparedQuotationPdfShare,
} from "@/lib/quotation-pdf-share";
import { buildWhatsAppShareHref, getWhatsAppSharePhoneState } from "@/lib/whatsapp";

type QuotationShareActionsProps = {
  quotationId: string;
  quotationNumber: string;
  initialPdfGeneratedAt?: string | null;
  initialShareToken?: string | null;
  initialSentAt?: string | null;
  initialStatus?: string | null;
  isDraft?: boolean;
  variant?: "full" | "listPrimary";
  onStateChange?: (state: {
    pdfGeneratedAt: string | null;
    shareToken: string | null;
    sentAt: string | null;
    status: string | null;
  }) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo completar la acción.";
}

function getShareStatusLabel(status: string | null, sentAt: string | null) {
  if (sentAt) {
    return `Compartida${status === "pending" ? " y marcada como pendiente" : ""} el ${formatDateTime(sentAt)}.`;
  }

  if (status === "pending") {
    return "Lista para seguimiento y reenvío.";
  }

  return null;
}

export function QuotationShareActions({
  quotationId,
  quotationNumber,
  initialPdfGeneratedAt = null,
  initialShareToken = null,
  initialSentAt = null,
  initialStatus = null,
  variant = "full",
  onStateChange,
}: QuotationShareActionsProps) {
  const { toast } = useToast();
  const [pdfGeneratedAt, setPdfGeneratedAt] = useState(initialPdfGeneratedAt);
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [sentAt, setSentAt] = useState(initialSentAt);
  const [shareStatus, setShareStatus] = useState(initialStatus);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [needsPhoneInput, setNeedsPhoneInput] = useState(false);
  const [preparedShare, setPreparedShare] =
    useState<PreparedQuotationPdfShare | null>(null);

  const pdfViewUrl = useMemo(
    () => `/api/quotations/${encodeURIComponent(quotationId)}/pdf`,
    [quotationId],
  );
  const pdfDownloadUrl = useMemo(() => `${pdfViewUrl}?download=1`, [pdfViewUrl]);

  const publicShareUrl = useMemo(() => {
    if (!shareToken) {
      return null;
    }

    return buildPublicAppPath(
      `/api/quotations/share/${encodeURIComponent(shareToken)}`,
    );
  }, [shareToken]);

  const shareStatusLabel = getShareStatusLabel(shareStatus, sentAt);

  function handleOpenPdf() {
    const openedWindow = window.open(pdfViewUrl, "_blank", "noopener,noreferrer");

    if (!openedWindow) {
      window.location.href = pdfViewUrl;
    }
  }

  async function resolveNormalizedSharePhone() {
    setIsLoadingRecipient(true);

    try {
      const result = await getQuotationWhatsappRecipientAction(quotationId);
      const phoneState = getWhatsAppSharePhoneState(result.clientPhone);
      setClientPhone(result.clientPhone);

      if (phoneState.requiresPhoneInput) {
        setNeedsPhoneInput(true);
        setPhoneInput(result.clientPhone ?? "");
        return null;
      }

      setNeedsPhoneInput(false);
      return phoneState.normalizedPhone;
    } finally {
      setIsLoadingRecipient(false);
    }
  }

  async function continueWhatsappShare(normalizedPhone: string) {
    const confirmed = window.confirm(
      `Se abrirá WhatsApp con un link público para ${quotationNumber} y la cotización quedará marcada como pendiente. ¿Querés continuar?`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setStatusMessage(null);
    setIsSharing(true);

    try {
      const result = await confirmQuotationWhatsappShareAction(quotationId);
      const whatsappHref = buildWhatsAppShareHref({
        phone: normalizedPhone,
        text: result.whatsappText,
      });

      setShareToken(result.shareToken);
      setSentAt(result.sentAt);
      setShareStatus(result.shareStatus);
      onStateChange?.({
        pdfGeneratedAt,
        shareToken: result.shareToken,
        sentAt: result.sentAt,
        status: result.shareStatus,
      });
      setStatusMessage("WhatsApp abierto con el destinatario precargado.");
      toast({
        title: "WhatsApp abierto",
        description: "La cotización se preparó para su envío.",
      });

      const openedWindow = window.open(
        whatsappHref,
        "_blank",
        "noopener,noreferrer",
      );

      if (!openedWindow) {
        window.location.href = whatsappHref;
      }
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsSharing(false);
    }
  }

  async function handleGeneratePdf() {
    setError(null);
    setStatusMessage(null);
    setIsGeneratingPdf(true);

    try {
      const result = await generateQuotationPdfAction(quotationId);
      setPdfGeneratedAt(result.generatedAt);
      onStateChange?.({
        pdfGeneratedAt: result.generatedAt,
        shareToken,
        sentAt,
        status: shareStatus,
      });
      setStatusMessage("PDF generado. Revisalo antes de compartir la cotización.");
      toast({
        title: "PDF generado",
        description: "Ya podés verlo, descargarlo o compartirlo.",
      });
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  /**
   * En celulares con Web Share API compartimos el PDF como archivo (el
   * cliente lo recibe como documento, sin links ni inicio de sesión).
   *
   * iOS suele rechazar el primer intento porque el "gesto" del toque vence
   * mientras se genera el PDF: en ese caso dejamos el archivo preparado y
   * mostramos el botón «Compartir PDF» para abrir el menú con un toque
   * directo. Devuelve true si el camino nativo quedó manejado.
   */
  async function tryNativePdfShare() {
    if (!supportsQuotationPdfFileShare()) {
      return false;
    }

    setError(null);
    setStatusMessage(null);
    setIsSharing(true);

    try {
      const result = await confirmQuotationWhatsappShareAction(quotationId);

      setShareToken(result.shareToken);
      setSentAt(result.sentAt);
      setShareStatus(result.shareStatus);
      onStateChange?.({
        pdfGeneratedAt,
        shareToken: result.shareToken,
        sentAt: result.sentAt,
        status: result.shareStatus,
      });

      const prepared = await prepareQuotationPdfShare({
        pdfUrl: pdfViewUrl,
        quotationNumber,
        clientName: result.clientName,
        text: result.whatsappFileText,
      });

      if (!prepared) {
        return false;
      }

      const shareOutcome = await presentQuotationPdfShare(prepared);

      if (shareOutcome === "shared") {
        setPreparedShare(null);
        setStatusMessage("PDF compartido. Quedó marcada como pendiente.");
        toast({
          title: "PDF listo para enviar",
          description: "Elegí WhatsApp y el contacto para mandarlo.",
        });
        return true;
      }

      // "blocked" (gesto vencido, típico de iPhone) o "cancelled": dejamos
      // el PDF preparado para compartir con un toque directo.
      setPreparedShare(prepared);
      setStatusMessage(
        "El PDF está listo. Tocá «Compartir PDF» para mandarlo por WhatsApp.",
      );
      return true;
    } catch {
      // Si algo falla en el camino nativo, seguimos con el fallback de wa.me.
      return false;
    } finally {
      setIsSharing(false);
    }
  }

  function handleSharePreparedPdf() {
    const prepared = preparedShare;

    if (!prepared) {
      return;
    }

    // Sin awaits antes de navigator.share: el toque habilita el menú nativo.
    void presentQuotationPdfShare(prepared)
      .then((outcome) => {
        if (outcome === "shared") {
          setPreparedShare(null);
          setStatusMessage("PDF compartido. Quedó marcada como pendiente.");
          toast({
            title: "PDF listo para enviar",
            description: "Elegí WhatsApp y el contacto para mandarlo.",
          });
        }
      })
      .catch((shareError: unknown) => {
        setError(getErrorMessage(shareError));
      });
  }

  async function handleShareWhatsapp() {
    setError(null);
    setStatusMessage(null);

    try {
      const sharedNatively = await tryNativePdfShare();

      if (sharedNatively) {
        return;
      }

      const normalizedPhone = await resolveNormalizedSharePhone();

      if (!normalizedPhone) {
        setError("Ingresá el teléfono del cliente antes de continuar con WhatsApp.");
        return;
      }

      await continueWhatsappShare(normalizedPhone);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    }
  }

  async function handleSavePhoneAndShare() {
    const phoneState = getWhatsAppSharePhoneState(phoneInput);

    if (!phoneInput.trim() || !phoneState.normalizedPhone) {
      setError("Ingresá un teléfono válido antes de compartir por WhatsApp.");
      return;
    }

    setError(null);
    setStatusMessage(null);
    setIsSavingPhone(true);

    try {
      const result = await saveQuotationClientPhoneAction(quotationId, phoneInput);
      setClientPhone(result.clientPhone);
      setPhoneInput(result.clientPhone ?? phoneInput.trim());
      setNeedsPhoneInput(false);
      toast({
        title: "Teléfono guardado",
        description: "El cliente ya tiene un número listo para futuros envíos.",
      });
      await continueWhatsappShare(phoneState.normalizedPhone);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsSavingPhone(false);
    }
  }

  const normalizedStatus = shareStatus?.trim().toLowerCase() ?? "draft";
  const isAccepted = normalizedStatus === "accepted";
  const isPending = normalizedStatus === "pending";

  function getListPrimaryLabel() {
    if (isAccepted) {
      return "Ver PDF";
    }
    if (isPending || sentAt) {
      return "Reenviar por WhatsApp";
    }
    return "Enviar por WhatsApp";
  }

  async function handleListPrimaryClick() {
    if (isAccepted) {
      if (!pdfGeneratedAt) {
        await handleGeneratePdf();
      }
      handleOpenPdf();
      return;
    }

    await handleShareWhatsapp();
  }

  if (variant === "listPrimary") {
    return (
      <div className="min-w-0 flex-1 space-y-2">
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {statusMessage ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {statusMessage}
          </p>
        ) : null}

        {preparedShare ? (
          <Button
            type="button"
            className="min-h-12 w-full bg-accent-token text-black hover:bg-accent-hover"
            onClick={handleSharePreparedPdf}
          >
            📤 Compartir PDF
          </Button>
        ) : needsPhoneInput ? (
          <div className="space-y-3 rounded-lg border border-token/80 bg-background/70 px-4 py-3">
            <div className="space-y-1">
              <Label htmlFor={`quotation-share-phone-${quotationId}`}>
                Teléfono del cliente
              </Label>
              <Input
                id={`quotation-share-phone-${quotationId}`}
                type="tel"
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                placeholder="Ej. 261 555 1234"
                disabled={isGeneratingPdf || isSharing || isLoadingRecipient || isSavingPhone}
              />
            </div>
            <Button
              type="button"
              className="min-h-12 w-full bg-accent-token text-black hover:bg-accent-hover"
              disabled={isGeneratingPdf || isSharing || isLoadingRecipient || isSavingPhone}
              onClick={() => {
                void handleSavePhoneAndShare();
              }}
            >
              {isSavingPhone ? "Guardando teléfono..." : "Guardar teléfono y compartir"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              type="button"
              className="min-h-11 w-fit gap-2 bg-accent-token px-4 text-black hover:bg-accent-hover"
              disabled={isGeneratingPdf || isSharing || isLoadingRecipient || isSavingPhone}
              onClick={() => {
                void handleListPrimaryClick();
              }}
            >
              {isGeneratingPdf || isSharing || isLoadingRecipient || isSavingPhone ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isGeneratingPdf
                ? "Generando PDF..."
                : isSharing || isLoadingRecipient
                  ? "Preparando PDF..."
                  : getListPrimaryLabel()}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-token/80 bg-background/60 px-4 py-3">

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {statusMessage}
        </p>
      ) : null}

      {shareStatusLabel ? (
        <p className="text-sm text-muted-foreground">{shareStatusLabel}</p>
      ) : null}

      {preparedShare ? (
        <Button
          type="button"
          className="min-h-12 w-full bg-accent-token text-black hover:bg-accent-hover"
          onClick={handleSharePreparedPdf}
        >
          📤 Compartir PDF
        </Button>
      ) : null}

      {clientPhone ? (
        <p className="text-sm text-muted-foreground">
          Destino de WhatsApp: <span className="font-medium text-foreground">{clientPhone}</span>
        </p>
      ) : null}

      {needsPhoneInput ? (
        <div className="space-y-3 rounded-lg border border-token/80 bg-background/70 px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor={`quotation-share-phone-${quotationId}`}>
              Teléfono del cliente
            </Label>
            <Input
              id={`quotation-share-phone-${quotationId}`}
              type="tel"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
              placeholder="Ej. 261 555 1234"
              disabled={isGeneratingPdf || isSharing || isLoadingRecipient || isSavingPhone}
            />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Esta cotización necesita un teléfono de cliente antes de abrir WhatsApp.
          </p>
          <Button
            type="button"
            className="bg-accent-token text-black hover:bg-accent-hover"
            disabled={isGeneratingPdf || isSharing || isLoadingRecipient || isSavingPhone}
            onClick={() => {
              void handleSavePhoneAndShare();
            }}
          >
            {isSavingPhone ? "Guardando teléfono..." : "Guardar teléfono y compartir"}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={pdfGeneratedAt ? "outline" : "default"}
          className={
            pdfGeneratedAt
              ? "border-token bg-background text-foreground"
              : "bg-accent-token text-black hover:bg-accent-hover"
          }
          disabled={isGeneratingPdf || isSharing}
          onClick={() => {
            void handleGeneratePdf();
          }}
        >
          {isGeneratingPdf
            ? "Generando PDF..."
            : pdfGeneratedAt
              ? "Actualizar PDF"
              : "Generar PDF"}
        </Button>

        {pdfGeneratedAt ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="border-token bg-background text-foreground"
              onClick={handleOpenPdf}
            >
              Ver PDF
            </Button>

            <Button
              type="button"
              variant="outline"
              className="border-token bg-background text-foreground"
              asChild
            >
              <a href={pdfDownloadUrl} download>
                Descargar PDF
              </a>
            </Button>

            <Button
              type="button"
              className="bg-accent-token text-black hover:bg-accent-hover"
              disabled={isSharing || isLoadingRecipient || isSavingPhone}
              onClick={() => {
                void handleShareWhatsapp();
              }}
            >
              {isLoadingRecipient
                ? "Cargando destinatario..."
                : isSharing
                  ? "Abriendo WhatsApp..."
                  : sentAt
                    ? "Reenviar por WhatsApp"
                    : "Compartir por WhatsApp"}
            </Button>

            {publicShareUrl ? (
              <Button
                type="button"
                variant="outline"
                className="border-token bg-background text-foreground"
                asChild
              >
                <a href={publicShareUrl} target="_blank" rel="noreferrer">
                  Copiar enlace
                </a>
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
