"use client";

import { useEffect, useRef, useState } from "react";
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
import type { HydratedInvoiceScanReview, InvoiceScanResult } from "@/types";

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
  persistedScan?: HydratedInvoiceScanReview | null;
  onScanPersisted: (payload: {
    scanId: string;
    fileName: string;
    status: "uploaded" | "processing" | "failed" | "completed";
    failureMessage: string | null;
  }) => void;
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
  persistedScan = null,
  onScanPersisted,
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

  useEffect(() => {
    if (persistedScan?.fileName) {
      setLastFileName(persistedScan.fileName);
    }
  }, [persistedScan?.fileName]);

  async function handleScanExistingPersistedInvoice(scan: {
    id: string;
    fileName: string;
  }) {
    setError(null);
    setStatus("Factura cargada. Analizando items...");
    setIsScanning(true);
    onScanPersisted({
      scanId: scan.id,
      fileName: scan.fileName,
      status: "processing",
      failureMessage: null,
    });

    try {
      const scanResponse = await fetch("/api/ai/invoice-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scanId: scan.id,
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
    } finally {
      setIsScanning(false);
    }
  }

  async function handleUploadAndScan() {
    if (!selectedFile) {
      setError("Selecciona una factura antes de iniciar el escaneo.");
      return;
    }

    setError(null);
    setStatus(null);
    setIsUploading(true);
    let uploadedScan: UploadedInvoiceScan | null = null;

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

      uploadedScan = uploadPayload.scan;
      setLastFileName(uploadedScan.fileName);
      onScanPersisted({
        scanId: uploadedScan.id,
        fileName: uploadedScan.fileName,
        status: "uploaded",
        failureMessage: null,
      });
      setIsUploading(false);

      await handleScanExistingPersistedInvoice({
        id: uploadedScan.id,
        fileName: uploadedScan.fileName,
      });
    } catch (scanError) {
      const message =
        scanError instanceof Error && scanError.message.trim()
          ? scanError.message
          : "No se pudo procesar la factura.";

      setError(message);

      if (uploadedScan) {
        onScanPersisted({
          scanId: uploadedScan.id,
          fileName: uploadedScan.fileName,
          status: /ya se esta analizando/i.test(message) ? "processing" : "failed",
          failureMessage: /ya se esta analizando/i.test(message) ? null : message,
        });
      }
    } finally {
      setIsUploading(false);
    }
  }

  const canRetryPersistedScan =
    Boolean(persistedScan?.scanId) &&
    persistedScan?.status !== "completed" &&
    persistedScan?.status !== "processing";

  return (
    <Card className="shell-panel overflow-hidden shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full border border-token/80 bg-background p-2 text-accent-token">
              <ScanSearch className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Escaneo asistido
              </div>
              <CardTitle className="text-xl">Escanear factura con AI</CardTitle>
              <CardDescription className="leading-6">
                Sube una imagen de factura o remito, espera la lectura asistida y
                revisa los items detectados antes de decidir si van a la cotizacion
                actual o al catalogo.
              </CardDescription>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            <p className="text-xs font-medium uppercase tracking-[0.18em]">
              Estado actual
            </p>
            <p className="mt-2 font-medium text-foreground">
              {status ?? error ?? (persistedScan?.status === "processing" ? "Escaneando factura" : "Listo para cargar")}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UploadCloud className="h-4 w-4 text-accent-token" />
              1. Carga
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Elige una imagen nitida de la factura o remito.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ScanSearch className="h-4 w-4 text-accent-token" />
              2. Analiza
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              AI interpreta los renglones y arma una revision editable.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileImage className="h-4 w-4 text-accent-token" />
              3. Decide
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Confirma que items van al borrador o al catalogo.
            </p>
          </div>
        </div>

        <div
          className={`rounded-[1.75rem] border border-dashed px-4 py-6 transition sm:px-5 ${
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
              {canRetryPersistedScan ? (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-background/75"
                  onClick={() =>
                    persistedScan
                      ? handleScanExistingPersistedInvoice({
                          id: persistedScan.scanId,
                          fileName: persistedScan.fileName,
                        }).catch((scanError) => {
                          const message =
                            scanError instanceof Error && scanError.message.trim()
                              ? scanError.message
                              : "No se pudo procesar la factura.";

                          setError(message);
                          onScanPersisted({
                            scanId: persistedScan.scanId,
                            fileName: persistedScan.fileName,
                            status: /ya se esta analizando/i.test(message)
                              ? "processing"
                              : "failed",
                            failureMessage: /ya se esta analizando/i.test(message)
                              ? null
                              : message,
                          });
                        })
                      : undefined
                  }
                  disabled={disabled || isUploading || isScanning}
                >
                  {persistedScan?.status === "failed"
                    ? "Reintentar ultimo escaneo"
                    : "Analizar factura cargada"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="bg-background/75"
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
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Archivo listo para escanear</p>
            <p className="mt-1 text-muted-foreground">{selectedFile.name}</p>
          </div>
        ) : null}

        {lastFileName ? (
          <div className="rounded-[1.5rem] border border-token/80 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
            Ultima factura subida: <span className="font-medium text-foreground">{lastFileName}</span>
          </div>
        ) : null}

        {persistedScan?.status === "processing" ? (
          <p className="rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            Esta factura ya tiene un escaneo en curso. Espera a que termine o
            vuelve a intentar cuando el proceso falle.
          </p>
        ) : null}

        {persistedScan?.status === "failed" && persistedScan.failureMessage ? (
          <p className="rounded-[1.5rem] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Ultimo intento fallido: {persistedScan.failureMessage}
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
      </CardContent>
    </Card>
  );
}
