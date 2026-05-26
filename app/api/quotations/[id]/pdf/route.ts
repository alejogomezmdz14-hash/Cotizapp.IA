import { createQuotationPdfRouteHandlers } from "@/lib/quotation-pdf-route";
import { getCurrentUser } from "@/lib/profile";
import {
  generateQuotationPdfForUser,
  getStoredQuotationPdfForUser,
} from "@/lib/quotations";

export const runtime = "nodejs";

const handlers = createQuotationPdfRouteHandlers({
  getCurrentUser,
  generateQuotationPdfForUser,
  getStoredQuotationPdfForUser,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
