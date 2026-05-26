import { NextResponse } from "next/server";

import { getSharedQuotationPdfForToken } from "@/lib/quotations";

type QuotationShareRouteDependencies = {
  getSharedQuotationPdf: typeof getSharedQuotationPdfForToken;
};

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function getErrorResponse(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;
  const status =
    message === "Falta indicar que cotizacion compartida quieres abrir."
      ? 400
      : message === "La cotizacion compartida no existe o ya no esta disponible." ||
          message === "El PDF de la cotizacion aun no fue generado."
        ? 404
        : 500;

  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

function buildPdfResponse(result: {
  fileName: string;
  bytes: Uint8Array;
}) {
  return new Response(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function getRouteShareToken(context: RouteContext) {
  const { token } = await context.params;
  return token.trim();
}

export function createQuotationShareRouteHandlers(
  dependencies: QuotationShareRouteDependencies,
) {
  return {
    GET: async (_request: Request, context: RouteContext) => {
      try {
        const shareToken = await getRouteShareToken(context);

        if (!shareToken) {
          return NextResponse.json(
            {
              error: "Falta indicar que cotizacion compartida quieres abrir.",
            },
            {
              status: 400,
            },
          );
        }

        const result = await dependencies.getSharedQuotationPdf(shareToken);

        return buildPdfResponse(result);
      } catch (error) {
        return getErrorResponse(
          error,
          "No se pudo abrir la cotizacion compartida.",
        );
      }
    },
  };
}
