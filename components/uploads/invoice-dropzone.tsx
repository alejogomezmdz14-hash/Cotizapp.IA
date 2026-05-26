"use client";

import { useRef, useState } from "react";
import { FileImage, ScanSearch, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { InvoiceScanResult } from "@/types";

type UploadedInvoiceScan = {
  id: string;
  filePath: string;
  fileName: string;
  createdAt: string | null;
  status: string | null;
};

type UploadInvoiceResponse = {
  scan?: UploadedInvoiceScan;
  error?: string;
};

type ScanInvoiceResponse = {
  scan?: {
    id: string;
    filePath: string;
    fileName: string;
    createdAt: string | null;
    status: string | null;
  };
  result?: InvoiceScanResult;
  error?: string;
};

type InvoiceDropzoneProps = {
  disabled?: boolean;
  onScanComplete: (payload: {
    scanId: string;
    fileName: string;
    result: InvoiceScanResult;
  }) => void;
};

async function getJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export function InvoiceDropzone({
  disabled = false,
  onScanComplete,
}: InvoiceDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  async function handleUploadAndScan() {
    if (!selectedFile) {
      setError("Selecciona una factura antes de iniciar el escaneo.");
      return;
    }

    setError(null);
    setStatus(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);

      const uploadResponse = await fetch("/api/uploads/invoice", {
        method: "POST",
        body: formData,
      });
      const uploadPayload =
        await getJsonResponse<UploadInvoiceResponse>(uploadResponse);

      if (!uploadResponse.ok || !uploadPayload.scan) {
        throw new Error(uploadPayload.error || "No se pudo subir la factura.");
      }

      setLastFileName(uploadPayload.scan.fileName);
      setStatus("Factura cargada. Analizando items...");
      setIsUploading(false);
      setIsScanning(true);

      const scanResponse = await fetch("/api/ai/invoice-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scanId: uploadPayload.scan.id,
        }),
      });
      const scanPayload = await getJsonResponse<ScanInvoiceResponse>(scanResponse);

      if (!scanResponse.ok || !scanPayload.scan || !scanPayload.result) {
        throw new Error(
          scanPayload.error || "No se pudo interpretar la factura subida.",
        );
      }

      onScanComplete({
        scanId: scanPayload.scan.id,
        fileName: scanPayload.scan.fileName,
        result: scanPayload.result,
      });
      setStatus(
        scanPayload.result.items.length > 0
          ? "Escaneo listo. Revisa y confirma los items antes de agregarlos."
          : "No detectamos items claros. Puedes volver a intentar con otra imagen.",
      );
      setSelectedFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (scanError) {
      setError(
        scanError instanceof Error && scanError.message.trim()
          ? scanError.message
          : "No se pudo procesar la factura.",
      );
    } finally {
      setIsUploading(false);
      setIsScanning(false);
    }
  }

  return (
    <Card className="border-token bg-surface shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-token/80 bg-background p-2 text-accent-token">
            <ScanSearch className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Escanear factura con AI</CardTitle>
            <CardDescription>
              Sube una imagen de factura o remito y revisa los items detectados
              antes de decidir si van a la cotizacion actual o al catalogo.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          className={`rounded-xl border border-dashed px-4 py-6 transition ${
            isDragActive
              ? "border-accent-token bg-accent-token/10"
              : "border-token/80 bg-background/60"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragActive(false);
            if (disabled || isUploading || isScanning) {
              return;
            }
            setSelectedFile(event.dataTransfer.files?.[0] ?? null);
            setError(null);
          }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <UploadCloud className="h-4 w-4 text-accent-token" />
                Arrastra la factura aqui o elige un archivo
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Formatos admitidos: PNG, JPG y WEBP. Tamano maximo: 10 MB.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-token bg-background"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || isUploading || isScanning}
              >
                <FileImage className="mr-2 h-4 w-4" />
                Elegir archivo
              </Button>
              <Button
                type="button"
                onClick={handleUploadAndScan}
                disabled={disabled || isUploading || isScanning || !selectedFile}
                className="bg-accent-token text-black hover:bg-accent-hover"
              >
                {isUploading
                  ? "Subiendo..."
                  : isScanning
                    ? "Escaneando..."
                    : "Subir y escanear"}
              </Button>
            </div>
          </div>

          <div className="sr-only">
            <Label htmlFor="invoice-scan-file">Factura</Label>
          </div>
          <input
            ref={inputRef}
            id="invoice-scan-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled || isUploading || isScanning}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setError(null);
            }}
            className="hidden"
          />
        </div>

        {selectedFile ? (
          <div className="rounded-lg border border-token/80 bg-background/60 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Archivo listo para escanear</p>
            <p className="mt-1 text-muted-foreground">{selectedFile.name}</p>
          </div>
        ) : null}

        {lastFileName ? (
          <p className="text-xs text-muted-foreground">
            Ultima factura subida: <span className="font-medium">{lastFileName}</span>
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
      </CardContent>
    </Card>
  );
}
