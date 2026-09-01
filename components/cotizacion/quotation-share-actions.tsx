"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

import {
  confirmQuotationWhatsappShareAction,
  generateQuotationPdfAction,
  getQuotationWhatsappRecipientAction,
  prepareQuotationWhatsappShareAction,
  saveQuotationClientPhoneAction,
  updateQuotationStatusAction,
} from "@/app/actions/quotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-provider";
import { buildPublicAppPath } from "@/lib/app-url";
import { formatDateTime } from "@/lib/formatting";
import { logError } from "@/lib/log";
import {
  prepareQuotationPdfShare,
  presentQuotationPdfShare,
  supportsQuotationPdfFileShare,
  type PreparedQuotationPdfShare,
} from "@/lib/quotation-pdf-share";
import {
  canUndoQuotationShare,
  describeQuotationShareAttempt,
  retryQuotationShare,
  runNativeQuotationShare,
  WHATSAPP_FALLBACK_MESSAGE,
} from "@/lib/quotation-share-flow";
import { buildWhatsAppShareHref, getWhatsAppSharePhoneState } from "@/lib/whatsapp";

type QuotationShareActionsProps = {
  quotationId: string;
  quotationNumber: string;
  initialPdfGeneratedAt?: string | null;
  initialShareToken?: string | null;
  initialSentAt?: string | null;
  initialStatus?: string | null;
  isDraft?: boolean;
  /**
   * Dónde mostrar los botones secundarios de PDF. En `"desktopOnly"` quedan
   * ocultos en el celular porque esas mismas acciones ya viven en el menú
   * «Más opciones» (QuotationMoreMenu), y dos botones verdes en una pantalla
   * son uno de más.
   */
  secondaryPdfActions?: "always" | "desktopOnly";
  onStateChange?: (state: {
    pdfGeneratedAt: string | null;
    shareToken: string | null;
    sentAt: string | null;
    status: string | null;
  }) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    // En producción Next enmascara los errores de server actions con un texto
    // genérico ("...Server Components render...omitted in production..."). No se
    // lo mostramos crudo al usuario.
    if (
      /server components render|omitted in production|a digest property/i.test(
        error.message,
      )
    ) {
      return "No pudimos completar la acción. Probá de nuevo en unos segundos.";
    }
    return error.message;
  }

  return "No se pudo completar la acción.";
}

function getShareStatusLabel(status: string | null, sentAt: string | null) {
  if (sentAt) {
    return `Enviada el ${formatDateTime(sentAt)}.`;
  }

  if (status === "pending" || status === "sent") {
    return "Lista para enviar y hacer seguimiento.";
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
  secondaryPdfActions = "always",
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
  // En el camino wa.me no hay forma de saber si el usuario mandó el mensaje:
  // se marca como enviada y se ofrece deshacer. Solo si antes no estaba enviada.
  const [undoShareVisible, setUndoShareVisible] = useState(false);
  const router = useRouter();

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

  function applyShareState(result: {
    shareToken: string;
    sentAt: string | null;
    shareStatus: string | null;
  }) {
    setShareToken(result.shareToken);
    setSentAt(result.sentAt);
    setShareStatus(result.shareStatus);
    onStateChange?.({
      pdfGeneratedAt,
      shareToken: result.shareToken,
      sentAt: result.sentAt,
      status: result.shareStatus,
    });
  }

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
    // Sin window.confirm: en el celular (PWA) ese diálogo nativo se descartaba
    // solo y abortaba el envío EN SILENCIO ("no pasa nada"). El toque en
    // "Enviar por WhatsApp" ya es la confirmación.
    setError(null);
    setStatusMessage(null);
    setIsSharing(true);

    const previousSentAt = sentAt;

    try {
      const result = await confirmQuotationWhatsappShareAction(quotationId);
      const whatsappHref = buildWhatsAppShareHref({
        phone: normalizedPhone,
        text: result.whatsappText,
      });

      applyShareState(result);
      // Acá NO hay forma de saber si el usuario apretó enviar: abrimos WhatsApp
      // y perdemos el control. Se marca como enviada porque es lo más probable,
      // pero el copy lo dice y se ofrece deshacer.
      setUndoShareVisible(canUndoQuotationShare(previousSentAt));
      setStatusMessage(WHATSAPP_FALLBACK_MESSAGE);
      toast({
        title: "Abrimos WhatsApp",
        description: "Revisá el mensaje y tocá enviar dentro de WhatsApp.",
      });

      const openedWindow = window.open(
        whatsappHref,
        "_blank",
        "noopener,noreferrer",
      );

      if (!openedWindow) {
        window.location.href = whatsappHref;
      }

      // Después de abrir WhatsApp: un router.refresh() justo antes del
      // window.open es el momento típico en que se pierde el popup.
      router.refresh();
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

  // El compartir (token + link público) requiere que el PDF ya esté generado.
  // Si falta, lo generamos primero para que "Enviar por WhatsApp" funcione de
  // una, sin tirar "Genera el PDF antes de compartir la cotización".
  async function ensurePdfGenerated() {
    if (pdfGeneratedAt) {
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const generated = await generateQuotationPdfAction(quotationId);
      setPdfGeneratedAt(generated.generatedAt);
      onStateChange?.({
        pdfGeneratedAt: generated.generatedAt,
        shareToken,
        sentAt,
        status: shareStatus,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  /**
   * En celulares con Web Share API compartimos el PDF como archivo (el cliente
   * lo recibe como documento, sin links ni inicio de sesión).
   *
   * El orden lo decide `runNativeQuotationShare`: se prepara el enlace, se arma
   * el archivo, se abre el menú, y SOLO si el sistema entregó el archivo se
   * marca la cotización como enviada. Antes se marcaba primero y quien cancelaba
   * quedaba con una cotización que decía "Enviada" sin haber mandado nada.
   *
   * Devuelve true si el camino nativo quedó manejado; false para seguir con wa.me.
   */
  async function tryNativePdfShare() {
    setError(null);
    setStatusMessage(null);
    setUndoShareVisible(false);
    setIsSharing(true);

    try {
      const attempt = await runNativeQuotationShare({
        isSupported: supportsQuotationPdfFileShare,
        prepareShare: async () => {
          const prepared = await prepareQuotationWhatsappShareAction(quotationId);
          // El enlace público ya existe; el estado todavía NO cambió.
          setShareToken(prepared.shareToken);
          return prepared;
        },
        buildShareFile: (share) =>
          prepareQuotationPdfShare({
            pdfUrl: pdfViewUrl,
            quotationNumber,
            clientName: share.clientName,
            text: share.whatsappFileText,
          }),
        presentShare: presentQuotationPdfShare,
        markAsSent: async () => {
          const confirmed = await confirmQuotationWhatsappShareAction(quotationId);
          applyShareState(confirmed);
          router.refresh();
        },
      });

      if (attempt.status === "unsupported" || attempt.status === "unavailable") {
        return false;
      }

      // Cancelado o bloqueado: el archivo ya está armado, así que el botón
      // «Compartir PDF» abre el menú con un toque directo, sin volver a
      // descargar el PDF.
      setPreparedShare(
        attempt.status === "shared" ? null : attempt.prepared,
      );

      const message = describeQuotationShareAttempt(attempt.status);

      if (message) {
        setStatusMessage(message.text);
      }

      if (attempt.status === "shared") {
        toast({
          title: "Cotización compartida",
          description: `${quotationNumber} quedó marcada como enviada.`,
        });
      }

      return true;
    } catch (shareError) {
      // Nada quedó marcado como enviado: preparar el enlace no toca el estado.
      // Se deja rastro y se sigue con wa.me en vez de dejar al usuario a pie.
      logError("cotizacion/compartir-nativo", shareError);
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

    setError(null);

    // Sin awaits antes de navigator.share: el toque habilita el menú nativo.
    void retryQuotationShare({
      prepared,
      presentShare: presentQuotationPdfShare,
      markAsSent: async () => {
        const confirmed = await confirmQuotationWhatsappShareAction(quotationId);
        applyShareState(confirmed);
        router.refresh();
      },
    })
      .then((outcome) => {
        // Antes este camino solo trataba "shared": si el segundo toque también
        // se cancelaba, la pantalla quedaba muda.
        if (outcome === "shared") {
          setPreparedShare(null);
          toast({
            title: "Cotización compartida",
            description: `${quotationNumber} quedó marcada como enviada.`,
          });
        }

        const message = describeQuotationShareAttempt(outcome);

        if (message) {
          setStatusMessage(message.text);
        }
      })
      .catch((shareError: unknown) => {
        setError(getErrorMessage(shareError));
      });
  }

  /**
   * Deshacer del camino wa.me: vuelve la cotización a borrador y limpia
   * `sent_at`. Solo se ofrece cuando marcarla como enviada cambió algo.
   */
  async function handleUndoShare() {
    setError(null);
    setIsSharing(true);

    try {
      const result = await updateQuotationStatusAction(quotationId, "draft");
      setSentAt(result.sentAt);
      setShareStatus(result.status);
      onStateChange?.({
        pdfGeneratedAt,
        shareToken,
        sentAt: result.sentAt,
        status: result.status,
      });
      setUndoShareVisible(false);
      setStatusMessage("Listo, la volvimos a borrador.");
      router.refresh();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsSharing(false);
    }
  }

  async function handleShareWhatsapp() {
    setError(null);
    setStatusMessage(null);

    try {
      await ensurePdfGenerated();

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
      await ensurePdfGenerated();
      await continueWhatsappShare(phoneState.normalizedPhone);
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsSavingPhone(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-token/80 bg-background/60 px-4 py-3">

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {statusMessage ? (
        <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {statusMessage}
          </p>
          {undoShareVisible ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-token bg-background text-foreground"
              disabled={isSharing}
              onClick={() => {
                void handleUndoShare();
              }}
            >
              No la mandé
            </Button>
          ) : null}
        </div>
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

      {/* Acción primaria: enviar por WhatsApp (objetivo #1 de la app).
          Siempre visible; si falta el PDF, el flujo de compartir lo genera solo. */}
      <Button
        type="button"
        className="min-h-12 w-full gap-2 bg-accent-token text-black hover:bg-accent-hover"
        disabled={isGeneratingPdf || isSharing || isLoadingRecipient || isSavingPhone}
        onClick={() => {
          void handleShareWhatsapp();
        }}
      >
        {isSharing || isLoadingRecipient ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isSharing || isLoadingRecipient
          ? "Preparando envío..."
          : sentAt
            ? "Reenviar por WhatsApp"
            : "Enviar por WhatsApp"}
      </Button>

      {/* Acciones secundarias del PDF */}
      <div
        className={
          secondaryPdfActions === "desktopOnly"
            ? "hidden flex-wrap gap-3 xl:flex"
            : "flex flex-wrap gap-3"
        }
      >
        <Button
          type="button"
          variant="outline"
          className="border-token bg-background text-foreground"
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

            {publicShareUrl ? (
              <Button
                type="button"
                variant="outline"
                className="border-token bg-background text-foreground"
                asChild
              >
                <a href={publicShareUrl} target="_blank" rel="noreferrer">
                  Abrir enlace público
                </a>
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
