import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/profile";
import {
  generateQuotationPdfForUser,
  getStoredQuotationPdfForUser,
} from "@/lib/quotations";

type QuotationPdfRouteDependencies = {
  getCurrentUser: typeof getCurrentUser;
  generateQuotationPdfForUser: typeof generateQuotationPdfForUser;
  getStoredQuotationPdfForUser: typeof getStoredQuotationPdfForUser;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function shouldAttemptRegeneration(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("aún no fue generado") ||
    message.includes("aun no fue generado") ||
    message.includes("object not found") ||
    message.includes("not found")
  );
}

function getErrorResponse(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;
  const status =
    message === "La cotización no existe o no te pertenece." ||
      message === "El PDF de la cotización aún no fue generado."
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

function buildPdfResponse(
  result: {
  fileName: string;
  bytes: Uint8Array;
},
  disposition: "inline" | "attachment",
) {
  return new Response(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function requireRouteUser(dependencies: QuotationPdfRouteDependencies) {
  const user = await dependencies.getCurrentUser();

  if (user) {
    return user;
  }

  return null;
}

async function getRouteQuotationId(context: RouteContext) {
  const { id } = await context.params;
  return id.trim();
}

export function createQuotationPdfRouteHandlers(
  dependencies: QuotationPdfRouteDependencies,
) {
  return {
    GET: async (request: Request, context: RouteContext) => {
      try {
        const user = await requireRouteUser(dependencies);

        if (!user) {
          return NextResponse.json(
            {
              error: "Debes iniciar sesión para descargar cotizaciones.",
            },
            {
              status: 401,
            },
          );
        }

        const quotationId = await getRouteQuotationId(context);

        if (!quotationId) {
          return NextResponse.json(
            {
              error: "Falta indicar qué cotización quieres descargar.",
            },
            {
              status: 400,
            },
          );
        }

        let result;
        try {
          result = await dependencies.getStoredQuotationPdfForUser(
            user.id,
            quotationId,
          );
        } catch (error) {
          if (!shouldAttemptRegeneration(error)) {
            throw error;
          }

          result = await dependencies.generateQuotationPdfForUser(
            user.id,
            quotationId,
          );
        }

        const url = new URL(request.url);
        const shouldDownload = url.searchParams.get("download") === "1";
        const disposition = shouldDownload ? "attachment" : "inline";

        return buildPdfResponse(result, disposition);
      } catch (error) {
        return getErrorResponse(error, "No se pudo descargar el PDF de la cotización.");
      }
    },
    POST: async (_request: Request, context: RouteContext) => {
      try {
        const user = await requireRouteUser(dependencies);

        if (!user) {
          return NextResponse.json(
            {
              error: "Debes iniciar sesión para generar cotizaciones.",
            },
            {
              status: 401,
            },
          );
        }

        const quotationId = await getRouteQuotationId(context);

        if (!quotationId) {
          return NextResponse.json(
            {
              error: "Falta indicar qué cotización quieres generar.",
            },
            {
              status: 400,
            },
          );
        }

        const result = await dependencies.generateQuotationPdfForUser(
          user.id,
          quotationId,
        );

        return buildPdfResponse(result, "attachment");
      } catch (error) {
        return getErrorResponse(error, "No se pudo generar el PDF de la cotización.");
      }
    },
  };
}
