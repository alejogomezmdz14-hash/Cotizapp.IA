import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/profile";
import {
  generateQuotationPdfForUser,
  getStoredQuotationPdfForUser,
} from "@/lib/quotations";

type QuotationPdfRouteDependencies = {
  getCurrentUser: typeof getCurrentUser;
  generateQuotationPdfForUser: typeof generateQuotationPdfForUser;
  renderQuotationPdfForUser?: (
    userId: string,
    quotationId: string,
  ) => Promise<{
    fileName: string;
    generatedAt: string;
    bytes: Uint8Array;
  }>;
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

        console.info("[quotation-pdf][GET] start", {
          quotationId,
          userId: user.id,
        });

        let result;
        try {
          result = await dependencies.getStoredQuotationPdfForUser(
            user.id,
            quotationId,
          );
          console.info("[quotation-pdf][GET] loaded stored pdf", {
            quotationId,
            userId: user.id,
            fileName: result.fileName,
            bytes: result.bytes.length,
          });
        } catch (error) {
          if (!shouldAttemptRegeneration(error)) {
            throw error;
          }

          console.warn("[quotation-pdf][GET] stored pdf unavailable, trying regeneration", {
            quotationId,
            userId: user.id,
            reason: error instanceof Error ? error.message : "unknown",
          });

          try {
            result = await dependencies.generateQuotationPdfForUser(
              user.id,
              quotationId,
            );
            console.info("[quotation-pdf][GET] regenerated and stored pdf", {
              quotationId,
              userId: user.id,
              fileName: result.fileName,
              bytes: result.bytes.length,
            });
          } catch (regenerationError) {
            if (!dependencies.renderQuotationPdfForUser) {
              throw regenerationError;
            }

            console.error("[quotation-pdf][GET] storage regeneration failed, using direct fallback", {
              quotationId,
              userId: user.id,
              reason:
                regenerationError instanceof Error
                  ? regenerationError.message
                  : "unknown",
            });

            result = await dependencies.renderQuotationPdfForUser(
              user.id,
              quotationId,
            );
          }
        }

        const url = new URL(request.url);
        const shouldDownload = url.searchParams.get("download") === "1";
        const disposition = shouldDownload ? "attachment" : "inline";

        return buildPdfResponse(result, disposition);
      } catch (error) {
        console.error("[quotation-pdf][GET] failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
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

        console.info("[quotation-pdf][POST] generating", {
          quotationId,
          userId: user.id,
        });
        const result = await dependencies.generateQuotationPdfForUser(
          user.id,
          quotationId,
        );
        console.info("[quotation-pdf][POST] generated", {
          quotationId,
          userId: user.id,
          fileName: result.fileName,
          bytes: result.bytes.length,
        });

        return buildPdfResponse(result, "attachment");
      } catch (error) {
        console.error("[quotation-pdf][POST] failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        return getErrorResponse(error, "No se pudo generar el PDF de la cotización.");
      }
    },
  };
}
