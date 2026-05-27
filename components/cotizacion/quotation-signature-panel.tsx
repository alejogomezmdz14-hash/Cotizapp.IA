"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Upload } from "lucide-react";

import { saveQuotationSignaturePathAction } from "@/app/actions/quotations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type QuotationSignaturePanelProps = {
  quotationId: string;
  currentSignaturePreviewUrl: string | null;
};

export function QuotationSignaturePanel({
  quotationId,
  currentSignaturePreviewUrl,
}: QuotationSignaturePanelProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentSignaturePreviewUrl);
  const [error, setError] = useState<string | null>(null);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = getPoint(event);
    if (!canvas || !point) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.strokeStyle = "#111827";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
    canvas.setPointerCapture(event.pointerId);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) {
      return;
    }

    const canvas = canvasRef.current;
    const point = getPoint(event);
    const context = canvas?.getContext("2d");
    if (!canvas || !point || !context) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) {
      return;
    }

    canvasRef.current?.releasePointerCapture(event.pointerId);
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function saveSignatureFromCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), "image/png");
      });

      if (!blob) {
        throw new Error("No se pudo generar la imagen de la firma.");
      }

      const formData = new FormData();
      formData.set("file", new File([blob], "signature.png", { type: "image/png" }));
      formData.set("quotationId", quotationId);

      const response = await fetch("/api/uploads/quotation-signature", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        signature?: { signaturePath: string; previewUrl: string | null };
        error?: string;
      };

      if (!response.ok || !payload.signature) {
        throw new Error(payload.error || "No se pudo guardar la firma.");
      }

      await saveQuotationSignaturePathAction(
        quotationId,
        payload.signature.signaturePath,
      );
      setPreviewUrl(payload.signature.previewUrl);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la firma.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUploadImage(file: File) {
    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("quotationId", quotationId);

      const response = await fetch("/api/uploads/quotation-signature", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        signature?: { signaturePath: string; previewUrl: string | null };
        error?: string;
      };

      if (!response.ok || !payload.signature) {
        throw new Error(payload.error || "No se pudo subir la firma.");
      }

      await saveQuotationSignaturePathAction(
        quotationId,
        payload.signature.signaturePath,
      );
      setPreviewUrl(payload.signature.previewUrl);
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo subir la firma.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-[1.75rem] border border-token/80 bg-background/70 p-4 sm:p-5 space-y-4">
      <div className="space-y-1">
        <Label>Firma del cliente</Label>
        <p className="text-sm text-muted-foreground">
          Dibujá con el mouse o el dedo, o subí una imagen. La firma aparece en el
          PDF.
        </p>
      </div>

      {previewUrl ? (
        <div className="overflow-hidden rounded-xl border border-token/80 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Firma guardada"
            className="mx-auto max-h-28 object-contain"
          />
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        className="w-full touch-none rounded-xl border border-dashed border-token bg-white"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={clearCanvas}>
          <Eraser className="mr-2 h-4 w-4" />
          Limpiar
        </Button>
        <Button type="button" onClick={saveSignatureFromCanvas} disabled={isSaving}>
          {isSaving ? "Guardando..." : "Guardar firma dibujada"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSaving}
        >
          <Upload className="mr-2 h-4 w-4" />
          Subir imagen
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUploadImage(file);
            }
          }}
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
