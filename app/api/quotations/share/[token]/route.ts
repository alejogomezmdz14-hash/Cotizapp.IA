import { createQuotationShareRouteHandlers } from "@/lib/quotation-share-route";
import { getSharedQuotationPdfForToken } from "@/lib/quotations";

const { GET } = createQuotationShareRouteHandlers({
  getSharedQuotationPdf: getSharedQuotationPdfForToken,
});

export { GET };
