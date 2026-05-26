INSERT INTO storage.buckets (id, name, public)
VALUES ('quotation-pdfs', 'quotation-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users manage own quotation PDFs'
  ) THEN
    CREATE POLICY "Users manage own quotation PDFs"
    ON storage.objects
    FOR ALL
    USING (
      bucket_id = 'quotation-pdfs'
      AND auth.uid()::text = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'quotation-pdfs'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;
