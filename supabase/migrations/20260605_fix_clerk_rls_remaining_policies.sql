-- Clerk auth catch-up: policies que el 20260602_clerk_auth_rls.sql no migró y
-- siguen usando auth.uid() (NULL bajo Clerk). Las pasamos a current_profile_id().
--
-- Afecta:
--   1. storage.objects bucket 'quotation-signatures'  (subir/leer firma)
--   2. storage.objects bucket 'quotation-share-pdfs'   (publicar PDF compartido)
--   3. tabla public.invoice_items                      (CRUD de ítems de factura)
--   4. limpieza: policy duplicada muerta en 'quotation-pdfs'
--
-- Idempotente: DROP IF EXISTS + CREATE, mismo patrón que 20260602.

-- Aseguramos que las funciones de resolución existan (no-op si ya están).
CREATE OR REPLACE FUNCTION public.clerk_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.jwt()->>'sub';
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM public.profiles
  WHERE clerk_id = public.clerk_user_id()
  LIMIT 1;
$$;

-- 1. invoice_items (tabla) ---------------------------------------------------
DROP POLICY IF EXISTS "Users manage own invoice items" ON public.invoice_items;
CREATE POLICY "Users manage own invoice items"
  ON public.invoice_items
  FOR ALL
  TO authenticated
  USING (
    public.current_profile_id() = (
      SELECT user_id FROM public.invoices WHERE id = invoice_id
    )
  )
  WITH CHECK (
    public.current_profile_id() = (
      SELECT user_id FROM public.invoices WHERE id = invoice_id
    )
  );

-- 2. storage: quotation-signatures ------------------------------------------
DROP POLICY IF EXISTS "Users manage own quotation signatures" ON storage.objects;
CREATE POLICY "Users manage own quotation signatures"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'quotation-signatures'
    AND public.current_profile_id()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'quotation-signatures'
    AND public.current_profile_id()::text = (storage.foldername(name))[1]
  );

-- 3. storage: quotation-share-pdfs ------------------------------------------
DROP POLICY IF EXISTS "Users manage own shared quotation PDFs" ON storage.objects;
CREATE POLICY "Users manage own shared quotation PDFs"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'quotation-share-pdfs'
    AND public.current_profile_id()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'quotation-share-pdfs'
    AND public.current_profile_id()::text = (storage.foldername(name))[1]
  );

-- 4. limpieza: policy duplicada muerta (mayúsculas) en quotation-pdfs --------
-- El 20260602 creó "Users manage own quotation pdfs" (minúsculas) con
-- current_profile_id(); esta vieja con auth.uid() quedó residual.
DROP POLICY IF EXISTS "Users manage own quotation PDFs" ON storage.objects;
