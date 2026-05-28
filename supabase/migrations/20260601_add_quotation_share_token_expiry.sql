-- Add expiry timestamp to shareable quotation links so public PDFs do not
-- stay accessible forever after being sent to a client by WhatsApp.

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;

-- Backfill: any existing share_token that does not have an expiry yet gets a
-- 90 day window starting from sent_at (fallback to created_at, then now).
UPDATE public.quotations
SET share_token_expires_at = COALESCE(sent_at, created_at, NOW()) + INTERVAL '90 days'
WHERE share_token IS NOT NULL
  AND share_token_expires_at IS NULL;

-- Replace the RPC so anonymous viewers cannot pull an expired PDF.
CREATE OR REPLACE FUNCTION public.get_shared_quotation_pdf_reference(
  share_token_input TEXT
)
RETURNS TABLE (
  user_id UUID,
  quotation_number TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    quotations.user_id,
    quotations.number AS quotation_number
  FROM public.quotations
  WHERE quotations.share_token = share_token_input
    AND quotations.pdf_generated_at IS NOT NULL
    AND (
      quotations.share_token_expires_at IS NULL
      OR quotations.share_token_expires_at > NOW()
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_quotation_pdf_reference(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_quotation_pdf_reference(TEXT) TO anon, authenticated;
