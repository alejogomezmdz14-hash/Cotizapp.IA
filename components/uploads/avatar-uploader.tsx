"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type AvatarUploaderProps = {
  currentAvatarUrl: string | null;
  currentAvatarPath: string | null;
  disabled?: boolean;
  onUploadStateChange?: (state: { isUploading: boolean }) => void;
};

type AvatarUploadResponse = {
  avatar?: {
    fileName: string;
    avatarPath: string;
    previewUrl: string | null;
  };
  error?: string;
};

async function getUploadResponse(response: Response): Promise<AvatarUploadResponse> {
  try {
    return (await response.json()) as AvatarUploadResponse;
  } catch {
    return {};
  }
}

export function AvatarUploader({
  currentAvatarUrl,
  currentAvatarPath,
  disabled = false,
  onUploadStateChange,
}: AvatarUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(
    currentAvatarPath ? "Foto lista para tu perfil." : null,
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [avatarPath, setAvatarPath] = useState<string | null>(currentAvatarPath);

  function syncUploadState(nextState: { isUploading: boolean }) {
    onUploadStateChange?.(nextState);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("Seleccioná una imagen antes de subir la foto.");
      return;
    }

    setIsUploading(true);
    syncUploadState({ isUploading: true });
    setError(null);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const response = await fetch("/api/uploads/avatar", {
        method: "POST",
        body: formData,
      });

      const payload = await getUploadResponse(response);

      if (!response.ok || !payload.avatar) {
        throw new Error(payload.error || "No se pudo subir la foto.");
      }

      setPreviewUrl(payload.avatar.previewUrl);
      setAvatarPath(payload.avatar.avatarPath);
      setSelectedFile(null);
      setStatus("Foto actualizada correctamente.");
      router.refresh();

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (uploadError) {
      syncUploadState({ isUploading: false });
      setError(
        uploadError instanceof Error && uploadError.message.trim()
          ? uploadError.message
          : "No se pudo subir la foto.",
      );
    } finally {
      setIsUploading(false);
      syncUploadState({ isUploading: false });
    }
  }

  return (
    <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <ImagePlus className="h-3.5 w-3.5 text-accent-token" />
            Foto de perfil
          </div>
          <h3 className="text-base font-semibold text-foreground">Tu imagen</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Se mostrará en tu avatar del header.
          </p>
        </div>
        <span className="rounded-full border border-token/80 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Opcional
        </span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex items-center justify-center">
          <Avatar className="h-28 w-28 border border-token/80 bg-surface-2">
            {previewUrl ? (
              <AvatarImage src={previewUrl} alt="Foto de perfil" />
            ) : (
              <AvatarFallback className="bg-surface-2 text-sm font-semibold text-foreground">
                {/* Placeholder initials are handled in the header */}
                Foto
              </AvatarFallback>
            )}
          </Avatar>
        </div>

        <div className="flex-1 space-y-3">
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            Elegí una imagen y subila. Podés cambiarla cuando quieras.
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-avatar">Archivo</Label>
            <input
              ref={inputRef}
              id="profile-avatar"
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

          {selectedFile ? (
            <p className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm text-foreground">
              Archivo seleccionado:{" "}
              <span className="font-medium">{selectedFile.name}</span>
            </p>
          ) : null}

          {status ? (
            <p className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {status}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={disabled || isUploading || !selectedFile}
            >
              {isUploading
                ? "Subiendo..."
                : avatarPath
                  ? "Actualizar foto"
                  : "Subir foto"}
            </Button>

            {avatarPath ? (
              <span className="inline-flex items-center gap-2 self-center text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-accent-token" />
                La foto se guarda al terminar la carga.
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

