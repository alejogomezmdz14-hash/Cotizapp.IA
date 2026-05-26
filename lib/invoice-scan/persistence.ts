import { getInvoiceScanDisplayFileName } from "@/lib/invoice-scan/file-name";
import type {
  HydratedInvoiceScanReview,
  InvoiceScan,
  InvoiceScanResult,
} from "@/types";

export type PublicInvoiceScan = {
  id: string;
  filePath: string;
  fileName: string;
  createdAt: string | null;
  status: string | null;
};

type RetryableResolvedInvoiceScan = {
  kind: "retryable";
  failureMessage: string | null;
};

type ReadyResolvedInvoiceScan = {
  kind: "ready";
  review: HydratedInvoiceScanReview;
};

type MissingResolvedInvoiceScan = {
  kind: "missing";
};

type ProcessingResolvedInvoiceScan = {
  kind: "processing";
};

type InvalidResolvedInvoiceScan = {
  kind: "invalid";
  reason: "missing-normalized-result" | "unsupported-status";
};

export type ResolvedPersistedInvoiceScan =
  | RetryableResolvedInvoiceScan
  | ReadyResolvedInvoiceScan
  | MissingResolvedInvoiceScan
  | ProcessingResolvedInvoiceScan
  | InvalidResolvedInvoiceScan;

export class PersistedInvoiceScanError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "PersistedInvoiceScanError";
    this.statusCode = statusCode;
  }
}

type LoadPersistedInvoiceScanReviewDependencies = {
  getScan: (scanId: string) => Promise<InvoiceScan | null>;
};

type ProcessPersistedInvoiceScanDependencies = {
  getScan: (scanId: string) => Promise<InvoiceScan | null>;
  markProcessing: (scanId: string) => Promise<boolean>;
  getSignedUrl: (filePath: string) => Promise<string>;
  scanWithAi: (input: {
    signedUrl: string;
    fileName?: string | null;
  }) => Promise<{
    rawResult: Record<string, unknown>;
    result: InvoiceScanResult;
  }>;
  markCompleted: (
    scanId: string,
    rawResult: Record<string, unknown>,
  ) => Promise<boolean>;
  markFailed: (scanId: string, message: string) => Promise<boolean>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNormalizedStatus(status: string | null) {
  return status?.trim().toLowerCase() ?? "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "No se pudo escanear la factura.";
}

function getPersistedFailureMessage(scan: Pick<InvoiceScan, "raw_result">) {
  if (!isRecord(scan.raw_result)) {
    return null;
  }

  const error = scan.raw_result.error;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

export function getCachedNormalizedInvoiceScanResult(
  scan: Pick<InvoiceScan, "raw_result">,
): InvoiceScanResult | null {
  if (!isRecord(scan.raw_result)) {
    return null;
  }

  const normalized = scan.raw_result.normalized;
  return isRecord(normalized) ? (normalized as InvoiceScanResult) : null;
}

export function buildNewQuotationPageHref({
  quotationId,
  scanId,
}: {
  quotationId?: string | null;
  scanId?: string | null;
}) {
  const searchParams = new URLSearchParams();
  const normalizedQuotationId = quotationId?.trim() ?? "";
  const normalizedScanId = scanId?.trim() ?? "";

  if (normalizedQuotationId) {
    searchParams.set("quotationId", normalizedQuotationId);
  }

  if (normalizedScanId) {
    searchParams.set("scanId", normalizedScanId);
  }

  const query = searchParams.toString();
  return query ? `/cotizaciones/nueva?${query}` : "/cotizaciones/nueva";
}

export function toPublicInvoiceScan(
  scan: Pick<InvoiceScan, "id" | "file_path" | "file_name" | "created_at" | "status">,
  statusOverride?: string | null,
): PublicInvoiceScan {
  return {
    id: scan.id,
    filePath: scan.file_path,
    fileName: getInvoiceScanDisplayFileName(scan),
    createdAt: scan.created_at,
    status: statusOverride ?? scan.status,
  };
}

export function resolvePersistedInvoiceScan(
  scan: InvoiceScan | null,
): ResolvedPersistedInvoiceScan {
  if (!scan) {
    return {
      kind: "missing",
    };
  }

  const status = getNormalizedStatus(scan.status);

  if (status === "completed") {
    const cachedResult = getCachedNormalizedInvoiceScanResult(scan);

    if (!cachedResult) {
      return {
        kind: "invalid",
        reason: "missing-normalized-result",
      };
    }

    return {
      kind: "ready",
      review: {
        scanId: scan.id,
        fileName: getInvoiceScanDisplayFileName(scan),
        status: "completed",
        failureMessage: null,
        result: cachedResult,
      },
    };
  }

  if (status === "processing") {
    return {
      kind: "processing",
    };
  }

  if (status === "uploaded" || status === "failed") {
    return {
      kind: "retryable",
      failureMessage: status === "failed" ? getPersistedFailureMessage(scan) : null,
    };
  }

  return {
    kind: "invalid",
    reason: "unsupported-status",
  };
}

export function hydratePersistedInvoiceScan(
  scan: InvoiceScan | null,
): HydratedInvoiceScanReview | null {
  if (!scan) {
    return null;
  }

  const status = getNormalizedStatus(scan.status);

  if (
    status !== "uploaded" &&
    status !== "processing" &&
    status !== "failed" &&
    status !== "completed"
  ) {
    return null;
  }

  if (status === "completed") {
    const cachedResult = getCachedNormalizedInvoiceScanResult(scan);

    if (!cachedResult) {
      return null;
    }

    return {
      scanId: scan.id,
      fileName: getInvoiceScanDisplayFileName(scan),
      status,
      failureMessage: null,
      result: cachedResult,
    };
  }

  return {
    scanId: scan.id,
    fileName: getInvoiceScanDisplayFileName(scan),
    status,
    failureMessage: status === "failed" ? getPersistedFailureMessage(scan) : null,
    result: null,
  };
}

export async function loadPersistedInvoiceScanReview(
  dependencies: LoadPersistedInvoiceScanReviewDependencies,
  scanId: string | null | undefined,
): Promise<HydratedInvoiceScanReview | null> {
  const normalizedScanId = scanId?.trim() ?? "";

  if (!normalizedScanId) {
    return null;
  }

  return hydratePersistedInvoiceScan(await dependencies.getScan(normalizedScanId));
}

export async function processPersistedInvoiceScan(
  dependencies: ProcessPersistedInvoiceScanDependencies,
  input: {
    scanId: string;
  },
) {
  const scanId = input.scanId.trim();
  const scan = await dependencies.getScan(scanId);
  const resolved = resolvePersistedInvoiceScan(scan);

  if (!scan || resolved.kind === "missing") {
    throw new PersistedInvoiceScanError(
      "La factura no existe o no te pertenece.",
      404,
    );
  }

  if (resolved.kind === "ready") {
    return {
      scan: toPublicInvoiceScan(scan, "completed"),
      result: resolved.review.result,
    };
  }

  if (resolved.kind === "processing") {
    throw new PersistedInvoiceScanError(
      "La factura ya se esta analizando.",
      409,
    );
  }

  if (resolved.kind === "invalid") {
    if (resolved.reason === "missing-normalized-result") {
      throw new PersistedInvoiceScanError(
        "La factura ya fue procesada, pero el resultado guardado es invalido.",
        409,
      );
    }

    throw new PersistedInvoiceScanError(
      "La factura tiene un estado invalido para ser analizada.",
      409,
    );
  }

  let shouldPersistFailure = false;

  try {
    const didMarkProcessing = await dependencies.markProcessing(scan.id);

    if (!didMarkProcessing) {
      const refreshedScan = await dependencies.getScan(scan.id);
      const refreshedResolved = resolvePersistedInvoiceScan(refreshedScan);

      if (refreshedScan && refreshedResolved.kind === "ready") {
        return {
          scan: toPublicInvoiceScan(refreshedScan, "completed"),
          result: refreshedResolved.review.result,
        };
      }

      if (refreshedResolved.kind === "processing") {
        throw new PersistedInvoiceScanError(
          "La factura ya se esta analizando.",
          409,
        );
      }

      throw new PersistedInvoiceScanError(
        "No se pudo bloquear la factura para procesarla.",
        409,
      );
    }

    shouldPersistFailure = true;

    const aiScan = await dependencies.scanWithAi({
      signedUrl: await dependencies.getSignedUrl(scan.file_path),
      fileName: getInvoiceScanDisplayFileName(scan),
    });
    const storedRawResult = {
      ...aiScan.rawResult,
      normalized: aiScan.result,
    };

    const didMarkCompleted = await dependencies.markCompleted(
      scan.id,
      storedRawResult,
    );

    if (!didMarkCompleted) {
      throw new PersistedInvoiceScanError(
        "No se pudo guardar el resultado del escaneo.",
        409,
      );
    }

    shouldPersistFailure = false;

    return {
      scan: toPublicInvoiceScan(scan, "completed"),
      result: aiScan.result,
    };
  } catch (error) {
    if (shouldPersistFailure) {
      const failureMessage = getErrorMessage(error);
      const didMarkFailed = await dependencies.markFailed(scan.id, failureMessage);

      if (!didMarkFailed) {
        throw new PersistedInvoiceScanError(
          `${failureMessage} Tambien fallo registrar el estado fallido del escaneo.`,
          409,
        );
      }
    }

    throw error;
  }
}
