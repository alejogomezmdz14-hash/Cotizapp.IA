import { createQuotationPdfRouteHandlers } from "@/lib/quotation-pdf-route";
import { getCurrentUser } from "@/lib/profile";
import {
  generateQuotationPdfForUser,
  renderQuotationPdfForUser,
  getStoredQuotationPdfForUser,
} from "@/lib/quotations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createQuotationPdfRouteHandlers({
  getCurrentUser,
  generateQuotationPdfForUser,
  renderQuotationPdfForUser,
  getStoredQuotationPdfForUser,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
