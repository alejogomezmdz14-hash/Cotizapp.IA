"use client";

import { useMemo, useRef, useState } from "react";
import { ImageIcon, Loader2, ShieldCheck } from "lucide-react";

import { completeOnboardingLogoStep } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";

type OnboardingLogoStepProps = {
  currentLogoUrl: string | null;
  currentLogoPath: string | null;
};

type LogoUploadResponse = {
  logo?: {
    fileName: string;
    logoPath: string;
    previewUrl: string | null;
  };
  error?: string;
};

async function parseLogoUploadResponse(response: Response): Promise<LogoUploadResponse> {
  try {
    return (await response.json()) as LogoUploadResponse;
  } catch {
    return {};
  }
}

export function OnboardingLogoStep({
  currentLogoUrl,
  currentLogoPath,
}: OnboardingLogoStepProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);
  const [logoPath, setLogoPath] = useState<string | null>(
    currentLogoPath ?? null,
  );

  const hasLogo = useMemo(() => Boolean(logoPath || previewUrl), [logoPath, previewUrl]);

  async function handleUpload() {
    setError(null);

    if (!selectedFile) {
      setError("Selecciona una imagen antes de subir el logo.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const response = await fetch("/api/uploads/logo", {
        method: "POST",
        body: formData,
      });

      const payload = await parseLogoUploadResponse(response);

      if (!response.ok || !payload.logo) {
        throw new Error(payload.error || "No se pudo subir el logo.");
      }

      setPreviewUrl(payload.logo.previewUrl);
      setLogoPath(payload.logo.logoPath);
      setSelectedFile(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error && uploadError.message.trim()
          ? uploadError.message
          : "No se pudo subir el logo.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fondo estilo “invoice fly” (placeholder CSS hasta que nos pasen una foto real). */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_15%,rgba(245,196,0,0.35),transparent_55%),radial-gradient(circle_at_80%_60%,rgba(16,185,129,0.20),transparent_50%),linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(0,0,0,0.35))]" />
      <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(90deg,rgba(245,196,0,0.25)_1px,transparent_1px),linear-gradient(rgba(245,196,0,0.25)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="w-full max-w-2xl">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Subí el logo de tu negocio
            </h1>
            <p className="text-sm leading-7 text-muted-foreground sm:text-base">
              Aparecerá en todas tus cotizaciones. Podés cambiarlo cuando
              quieras.
            </p>
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-6">
            <div
              className="relative flex min-h-[280px] flex-col items-center justify-center gap-4 overflow-hidden rounded-[1.5rem] border-2 border-dashed border-token/80 bg-background/60 p-6 text-center transition"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  setError(null);
                }
              }}
            >
              <input
                ref={inputRef}
                id="onboarding-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={isUploading}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  setError(null);
                }}
              />

              {previewUrl ? (
                <div className="flex w-full flex-col items-center gap-4">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[1.5rem] border border-token/80 bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Vista previa del logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ShieldCheck className="h-4 w-4 text-accent-token" />
                      Logo listo para usar
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Podés ajustar el logo cuando quieras.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.5rem] border border-token/80 bg-background">
                    <ImageIcon className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Arrastrá y soltá tu logo acá
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Formatos PNG, JPG y WEBP. Máximo 5 MB.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-background/75"
                  disabled={isUploading}
                  onClick={() => inputRef.current?.click()}
                >
                  Elegir imagen
                </Button>

                {selectedFile ? (
                  <Button
                    type="button"
                    disabled={isUploading}
                    onClick={handleUpload}
                    className="bg-accent-token text-black hover:bg-accent-token/90"
                  >
                    {isUploading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Subiendo...
                      </span>
                    ) : previewUrl ? (
                      "Actualizar logo"
                    ) : (
                      "Subir logo"
                    )}
                  </Button>
                ) : null}
              </div>

              {error ? (
                <p className="mt-2 rounded-[1.25rem] border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              {!hasLogo && !isUploading ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Podés subir tu logo más tarde desde tu perfil
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-accent-token">•</span> Listo en un minuto.
            </div>

            <form action={completeOnboardingLogoStep}>
              <Button type="submit" disabled={isUploading}>
                Continuar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

