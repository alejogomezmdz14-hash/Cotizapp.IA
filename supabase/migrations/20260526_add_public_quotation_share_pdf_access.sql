INSERT INTO storage.buckets (id, name, public)
VALUES ('quotation-share-pdfs', 'quotation-share-pdfs', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users manage own shared quotation PDFs'
  ) THEN
    CREATE POLICY "Users manage own shared quotation PDFs"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'quotation-share-pdfs'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'quotation-share-pdfs'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

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
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_quotation_pdf_reference(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_quotation_pdf_reference(TEXT) TO anon, authenticated;
