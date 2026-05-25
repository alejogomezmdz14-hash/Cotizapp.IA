INSERT INTO storage.buckets (id, name, public)
VALUES
  ('business-assets', 'business-assets', false),
  ('quotation-attachments', 'quotation-attachments', false),
  ('invoice-uploads', 'invoice-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users manage own business assets"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'business-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'business-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users manage own quotation attachments"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'quotation-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'quotation-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users manage own invoice uploads"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'invoice-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'invoice-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
