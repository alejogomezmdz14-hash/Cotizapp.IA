import { NextResponse } from "next/server";

import { scanInvoiceWithAi } from "@/lib/ai/invoice";
import { getInvoiceScanDisplayFileName } from "@/lib/invoice-scan/file-name";
import { getCurrentUser } from "@/lib/profile";
import { createSignedFileUrl, STORAGE_BUCKETS } from "@/lib/storage/server";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceScan, InvoiceScanResult } from "@/types";

type InvoiceScanRequestBody = {
  scanId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorResponse(error: unknown) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : "No se pudo escanear la factura.";

  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 500,
    },
  );
}

function getCachedNormalizedResult(scan: InvoiceScan): InvoiceScanResult | null {
  if (!isRecord(scan.raw_result)) {
    return null;
  }

  const normalized = scan.raw_result.normalized;
  return isRecord(normalized) ? (normalized as InvoiceScanResult) : null;
}

export async function POST(request: Request) {
  let scanIdForFailure: string | null = null;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Debes iniciar sesion para escanear facturas.",
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
          error: "Falta indicar que factura quieres escanear.",
        },
        {
          status: 400,
        },
      );
    }

    scanIdForFailure = scanId;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoice_scans")
      .select("*")
      .eq("id", scanId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error("No se pudo cargar la factura para escanear.");
    }

    const scan = (data as InvoiceScan | null) ?? null;

    if (!scan) {
      return NextResponse.json(
        {
          error: "La factura no existe o no te pertenece.",
        },
        {
          status: 404,
        },
      );
    }

    const cachedResult = getCachedNormalizedResult(scan);

    if (scan.status === "completed" && cachedResult) {
      return NextResponse.json({
        scan: {
          id: scan.id,
          filePath: scan.file_path,
          fileName: getInvoiceScanDisplayFileName(scan),
          createdAt: scan.created_at,
          status: scan.status,
        },
        result: cachedResult,
      });
    }

    await supabase
      .from("invoice_scans")
      .update({
        status: "processing",
      })
      .eq("id", scan.id)
      .eq("user_id", user.id);

    const signedUrl = await createSignedFileUrl(
      STORAGE_BUCKETS.invoiceUploads,
      scan.file_path,
    );

    const aiScan = await scanInvoiceWithAi({
      signedUrl,
      fileName: getInvoiceScanDisplayFileName(scan),
    });

    const storedRawResult = {
      ...aiScan.rawResult,
      normalized: aiScan.result,
    };

    const { error: updateError } = await supabase
      .from("invoice_scans")
      .update({
        status: "completed",
        raw_result: storedRawResult,
      })
      .eq("id", scan.id)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error("No se pudo guardar el resultado del escaneo.");
    }

    return NextResponse.json({
      scan: {
        id: scan.id,
        filePath: scan.file_path,
        fileName: getInvoiceScanDisplayFileName(scan),
        createdAt: scan.created_at,
        status: "completed",
      },
      result: aiScan.result,
    });
  } catch (error) {
    if (scanIdForFailure) {
      try {
        const user = await getCurrentUser();

        if (user) {
          const supabase = await createClient();
          const message =
            error instanceof Error && error.message.trim()
              ? error.message
              : "No se pudo escanear la factura.";

          await supabase
            .from("invoice_scans")
            .update({
              status: "failed",
              raw_result: {
                error: message,
              },
            })
            .eq("id", scanIdForFailure)
            .eq("user_id", user.id);
        }
      } catch {
        // Ignore secondary persistence errors when the main scan fails.
      }
    }

    return getErrorResponse(error);
  }
}
