import { NextResponse } from "next/server";

import {
  buildInvoiceScanImageDataUrl,
} from "@/lib/invoice-scan/image-data-url";
import { scanInvoiceWithAi } from "@/lib/ai/invoice";
import {
  PersistedInvoiceScanError,
  processPersistedInvoiceScan,
} from "@/lib/invoice-scan/persistence";
import { getCurrentUser } from "@/lib/profile";
import { downloadFile, STORAGE_BUCKETS } from "@/lib/storage/server";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceScan } from "@/types";

type InvoiceScanRequestBody = { scanId?: string };

function getErrorResponse(error: unknown) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "No se pudo escanear la factura.";
  const status =
    error instanceof PersistedInvoiceScanError ? error.statusCode : 500;

  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

async function getInvoiceScanForUser(userId: string, scanId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("No se pudo cargar la factura para escanear.");
  }

  return (data as InvoiceScan | null) ?? null;
}

async function updateInvoiceScanForUser(input: {
  userId: string;
  scanId: string;
  values: {
    status: string;
    raw_result?: Record<string, unknown> | null;
  };
  allowedStatuses: string[];
  errorMessage: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_scans")
    .update(input.values)
    .eq("id", input.scanId)
    .eq("user_id", input.userId)
    .in("status", input.allowedStatuses)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(input.errorMessage);
  }

  return Boolean(data);
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Tenés que iniciar sesión para escanear facturas.",
        },
        {
          status: 401,
        },
      );
    }

    const body = (await request.json()) as InvoiceScanRequestBody;
    const scanId = typeof body.scanId === "string" ? body.scanId.trim() : "";

    if (!scanId) {
      return NextResponse.json(
        {
          error: "Falta indicar que factura querés escanear.",
        },
        {
          status: 400,
        },
      );
    }

    const response = await processPersistedInvoiceScan(
      {
        getScan: (targetScanId) => getInvoiceScanForUser(user.id, targetScanId),
        markProcessing: (targetScanId) =>
          updateInvoiceScanForUser({
            userId: user.id,
            scanId: targetScanId,
            values: {
              status: "processing",
              raw_result: null,
            },
            allowedStatuses: ["uploaded", "failed"],
            errorMessage: "No se pudo bloquear la factura para procesarla.",
          }),
        getInvoiceImageDataUrl: async (filePath) => {
          const file = await downloadFile(STORAGE_BUCKETS.invoiceUploads, filePath);

          return buildInvoiceScanImageDataUrl(
            file.bytes,
            file.contentType,
            filePath.split("/").pop(),
          );
        },
        scanWithAi: ({ imageDataUrl, fileName }) =>
          scanInvoiceWithAi({
            imageDataUrl,
            fileName,
          }),
        markCompleted: (targetScanId, rawResult) =>
          updateInvoiceScanForUser({
            userId: user.id,
            scanId: targetScanId,
            values: {
              status: "completed",
              raw_result: rawResult,
            },
            allowedStatuses: ["processing"],
            errorMessage: "No se pudo guardar el resultado del escaneo.",
          }),
        markFailed: (targetScanId, message) =>
          updateInvoiceScanForUser({
            userId: user.id,
            scanId: targetScanId,
            values: {
              status: "failed",
              raw_result: {
                error: message,
              },
            },
            allowedStatuses: ["processing"],
            errorMessage: "No se pudo registrar el estado fallido del escaneo.",
          }),
      },
      {
        scanId,
      },
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[invoice-scan][POST] failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return getErrorResponse(error);
  }
}
