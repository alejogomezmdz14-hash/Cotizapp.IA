"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type LogoUploaderProps = {
  currentLogoUrl: string | null;
  currentLogoPath: string | null;
  disabled?: boolean;
  onUploadStateChange?: (state: {
    isUploading: boolean;
    logoPath: string | null;
  }) => void;
};

type LogoUploadResponse = {
  logo?: {
    fileName: string;
    logoPath: string;
    previewUrl: string | null;
  };
  error?: string;
};

async function getUploadResponse(response: Response): Promise<LogoUploadResponse> {
  try {
    return (await response.json()) as LogoUploadResponse;
  } catch {
    return {};
  }
}

export function LogoUploader({
  currentLogoUrl,
  currentLogoPath,
  disabled = false,
  onUploadStateChange,
}: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(
    currentLogoPath ? "Logo listo para usar en tu cuenta." : null,
  );
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
  const [logoPath, setLogoPath] = useState(currentLogoPath);

  function syncUploadState(nextState: {
    isUploading: boolean;
    logoPath: string | null;
  }) {
    onUploadStateChange?.(nextState);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("Selecciona una imagen antes de subir el logo.");
      return;
    }

    let nextLogoPath = logoPath;
    setIsUploading(true);
    syncUploadState({
      isUploading: true,
      logoPath,
    });
    setError(null);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const response = await fetch("/api/uploads/logo", {
        method: "POST",
        body: formData,
      });
      const payload = await getUploadResponse(response);

      if (!response.ok || !payload.logo) {
        throw new Error(payload.error || "No se pudo subir el logo.");
      }

      setLogoUrl(payload.logo.previewUrl);
      setLogoPath(payload.logo.logoPath);
      nextLogoPath = payload.logo.logoPath;
      setSelectedFile(null);
      setStatus("Logo actualizado correctamente.");

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (uploadError) {
      syncUploadState({
        isUploading: false,
        logoPath,
      });
      setError(
        uploadError instanceof Error && uploadError.message.trim()
          ? uploadError.message
          : "No se pudo subir el logo.",
      );
    } finally {
      setIsUploading(false);
      syncUploadState({
        isUploading: false,
        logoPath: nextLogoPath,
      });
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-token/80 bg-background/60 p-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Logo del negocio</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Puedes subirlo ahora para dejar tu marca lista en futuras cotizaciones.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-token/80 bg-surface text-center text-xs text-muted-foreground">
          {logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo actual del negocio"
                className="h-full w-full object-contain"
              />
            </>
          ) : (
            <span className="px-2">Sin logo cargado</span>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="business-logo">Archivo</Label>
            <input
              ref={inputRef}
              id="business-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={disabled || isUploading}
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setError(null);
              }}
              className="block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent-token file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Formatos admitidos: PNG, JPG y WEBP. Tamano maximo: 5 MB.
          </p>

          {selectedFile ? (
            <p className="text-sm text-foreground">
              Archivo seleccionado: <span className="font-medium">{selectedFile.name}</span>
            </p>
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

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={disabled || isUploading || !selectedFile}
              className="bg-accent-token text-black hover:bg-accent-hover"
            >
              {isUploading
                ? "Subiendo logo..."
                : logoPath
                  ? "Actualizar logo"
                  : "Subir logo"}
            </Button>

            {logoPath ? (
              <span className="self-center text-xs text-muted-foreground">
                El logo se guarda apenas termina la carga.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
