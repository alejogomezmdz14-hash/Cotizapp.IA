import type { HydratedInvoiceScanReview } from "@/types";

export function mergeHydratedInvoiceScanReview(
  currentReview: HydratedInvoiceScanReview | null,
  nextReview: HydratedInvoiceScanReview | null,
) {
  if (!nextReview) {
    return null;
  }

  if (!currentReview || currentReview.scanId !== nextReview.scanId) {
    return nextReview;
  }

  // Preserve the current completed review for the same scan id so a
  // router.refresh() or stale server payload does not wipe local edits.
  if (currentReview.result) {
    return currentReview;
  }

  return nextReview;
}
