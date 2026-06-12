"use client";

import { useEffect, useRef, useState } from "react";

import { deleteQuotationAttachmentAction } from "@/app/actions/quotations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { HydratedQuotationAttachment } from "@/types";

type UploadResponse = {
  attachments?: HydratedQuotationAttachment[];
  error?: string;
};

type QuotationAttachmentsProps = {
  quotationId: string | null;
  initialAttachments?: HydratedQuotationAttachment[];
  readOnly?: boolean;
};

function isPreviewableAttachment(fileType: string | null) {
  return Boolean(
    fileType && (fileType.startsWith("image/") || fileType === "application/pdf"),
  );
}

function getAttachmentLabel(attachment: HydratedQuotationAttachment) {
  if (attachment.fileName?.trim()) {
    return attachment.fileName;
  }

  return "Adjunto sin nombre";
}

async function getUploadResponse(response: Response): Promise<UploadResponse> {
  try {
    return (await response.json()) as UploadResponse;
  } catch {
    return {};
  }
}

export function QuotationAttachments({
  quotationId,
  initialAttachments = [],
  readOnly = false,
}: QuotationAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<HydratedQuotationAttachment[]>(
    initialAttachments,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments, quotationId]);

  async function handleUpload() {
    if (readOnly) {
      setError("Los adjuntos quedan en solo lectura después de compartir la cotización.");
      return;
    }

    if (!quotationId) {
      setError("Guarda el borrador antes de subir adjuntos.");
      return;
    }

    if (selectedFiles.length === 0) {
      setError("Seleccioná al menos un archivo para adjuntar.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.set("quotationId", quotationId);

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/uploads/quotation-attachment", {
        method: "POST",
        body: formData,
      });
      const payload = await getUploadResponse(response);

      if (!response.ok || !payload.attachments) {
        throw new Error(payload.error || "No se pudieron subir los adjuntos.");
      }

      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...payload.attachments!,
      ]);
      setSelectedFiles([]);
      setStatus(
        payload.attachments.length === 1
          ? "Adjunto cargado correctamente."
          : "Adjuntos cargados correctamente.",
      );

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error && uploadError.message.trim()
          ? uploadError.message
          : "No se pudieron subir los adjuntos.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemoveAttachment(id: string) {
    if (readOnly) {
      setError("Los adjuntos quedan en solo lectura después de compartir la cotización.");
      return;
    }

    setRemovingId(id);
    setError(null);
    setStatus(null);

    try {
      await deleteQuotationAttachmentAction(id);
      setAttachments((currentAttachments) =>
        currentAttachments.filter((attachment) => attachment.id !== id),
      );
      setStatus("Adjunto eliminado correctamente.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error && deleteError.message.trim()
          ? deleteError.message
          : "No se pudo eliminar el adjunto.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card className="border-token bg-surface shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Fotos y documentos</CardTitle>
        <CardDescription>
          Sumá fotos, PDFs o documentos relacionados con esta cotización.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!quotationId ? (
          <div className="rounded-lg border border-dashed border-token/80 bg-background/60 px-4 py-5 text-sm leading-6 text-muted-foreground">
            Guardá primero la cotización para poder subir archivos.
          </div>
        ) : readOnly ? (
          <div className="rounded-lg border border-token/80 bg-background/60 px-4 py-5 text-sm leading-6 text-muted-foreground">
            La cotización ya fue compartida. Los adjuntos siguen disponibles para
            consulta, pero las cargas y eliminaciones quedan bloqueadas.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="quotation-attachments">Archivos</Label>
              <input
                ref={inputRef}
                id="quotation-attachments"
                type="file"
                multiple
                disabled={isUploading}
                onChange={(event) => {
                  setSelectedFiles(Array.from(event.target.files ?? []));
                  setError(null);
                }}
                className="block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent-token file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Podés elegir un archivo o varios a la vez. Tamaño máximo por archivo:
              10 MB.
            </p>

            {selectedFiles.length > 0 ? (
              <div className="rounded-lg border border-token/80 bg-background/60 px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  {selectedFiles.length} archivo(s) listo(s) para subir
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {selectedFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {status ? (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {status}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
              className="bg-accent-token text-black hover:bg-accent-hover"
            >
              {isUploading ? "Subiendo adjuntos..." : "Subir adjuntos"}
            </Button>
          </>
        )}

        {attachments.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Archivos cargados
            </p>

            <div className="space-y-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-lg border border-token/80 bg-background/60 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-4">
                      {isPreviewableAttachment(attachment.fileType) &&
                      attachment.url &&
                      attachment.fileType?.startsWith("image/") ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={attachment.url}
                            alt={getAttachmentLabel(attachment)}
                            className="h-20 w-20 rounded-md border border-token/80 object-cover"
                          />
                        </>
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-md border border-token/80 bg-surface text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          {attachment.fileType === "application/pdf" ? "PDF" : "DOC"}
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {getAttachmentLabel(attachment)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.fileType || "Archivo"}
                        </p>

                        {attachment.url ? (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm font-medium text-accent-token underline-offset-4 hover:underline"
                          >
                            {isPreviewableAttachment(attachment.fileType)
                              ? "Abrir vista previa"
                              : "Descargar archivo"}
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            La vista previa estara disponible al volver a cargar la
                            pantalla.
                          </p>
                        )}
                      </div>
                    </div>

                    {readOnly ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        disabled={removingId === attachment.id}
                        className="border-token bg-background"
                      >
                        {removingId === attachment.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
