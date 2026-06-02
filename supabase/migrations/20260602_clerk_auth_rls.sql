-- Clerk auth: map Clerk user IDs to existing profile UUIDs and update RLS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clerk_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_clerk_id_key
  ON public.profiles (clerk_id)
  WHERE clerk_id IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

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

-- profiles
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (clerk_id = public.clerk_user_id())
  WITH CHECK (clerk_id = public.clerk_user_id());

-- catalog_items
DROP POLICY IF EXISTS "Users manage own catalog" ON public.catalog_items;
CREATE POLICY "Users manage own catalog"
  ON public.catalog_items
  FOR ALL
  TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

-- clients
DROP POLICY IF EXISTS "Users manage own clients" ON public.clients;
CREATE POLICY "Users manage own clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

-- quotations
DROP POLICY IF EXISTS "Users manage own quotations" ON public.quotations;
CREATE POLICY "Users manage own quotations"
  ON public.quotations
  FOR ALL
  TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

-- quotation_items
DROP POLICY IF EXISTS "Users manage own quotation items" ON public.quotation_items;
CREATE POLICY "Users manage own quotation items"
  ON public.quotation_items
  FOR ALL
  TO authenticated
  USING (
    public.current_profile_id() = (
      SELECT user_id FROM public.quotations WHERE id = quotation_id
    )
  )
  WITH CHECK (
    public.current_profile_id() = (
      SELECT user_id FROM public.quotations WHERE id = quotation_id
    )
  );

-- quotation_attachments
DROP POLICY IF EXISTS "Users manage own quotation attachments" ON public.quotation_attachments;
CREATE POLICY "Users manage own quotation attachments"
  ON public.quotation_attachments
  FOR ALL
  TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

-- invoice_scans
DROP POLICY IF EXISTS "Users manage own invoice scans" ON public.invoice_scans;
CREATE POLICY "Users manage own invoice scans"
  ON public.invoice_scans
  FOR ALL
  TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

-- expenses
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Users manage own expenses"
  ON public.expenses
  FOR ALL
  TO authenticated
  USING (user_id = public.current_profile_id())
  WITH CHECK (user_id = public.current_profile_id());

-- invoices (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users manage own invoices" ON public.invoices';
    EXECUTE '
      CREATE POLICY "Users manage own invoices"
      ON public.invoices
      FOR ALL
      TO authenticated
      USING (user_id = public.current_profile_id())
      WITH CHECK (user_id = public.current_profile_id())
    ';
  END IF;
END $$;

-- Dashboard metrics RPC
CREATE OR REPLACE FUNCTION public.get_dashboard_quotation_metrics()
RETURNS TABLE (
  quotations BIGINT,
  sent_quotations BIGINT,
  accepted_quotations BIGINT,
  pending_quotations BIGINT,
  total_quoted_this_month NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH current_user_context AS (
    SELECT
      public.current_profile_id() AS user_id,
      (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS month_start,
      ((date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC') AS next_month_start
  )
  SELECT
    COUNT(quotations.id)::BIGINT AS quotations,
    COUNT(quotations.id) FILTER (
      WHERE quotations.sent_at IS NOT NULL
        AND quotations.sent_at >= current_user_context.month_start
        AND quotations.sent_at < current_user_context.next_month_start
        AND lower(btrim(COALESCE(quotations.status, ''))) IN ('pending', 'sent')
    )::BIGINT AS sent_quotations,
    COUNT(quotations.id) FILTER (
      WHERE lower(btrim(COALESCE(quotations.status, ''))) IN ('accepted', 'approved')
        AND quotations.created_at >= current_user_context.month_start
        AND quotations.created_at < current_user_context.next_month_start
    )::BIGINT AS accepted_quotations,
    COUNT(quotations.id) FILTER (
      WHERE lower(btrim(COALESCE(quotations.status, ''))) IN ('pending', 'sent')
        AND quotations.created_at >= current_user_context.month_start
        AND quotations.created_at < current_user_context.next_month_start
        AND quotations.sent_at IS NULL
    )::BIGINT AS pending_quotations,
    COALESCE(
      SUM(
        CASE
          WHEN quotations.created_at >= current_user_context.month_start
            AND quotations.created_at < current_user_context.next_month_start
            AND lower(btrim(COALESCE(quotations.status, ''))) IN ('accepted', 'approved')
          THEN COALESCE(quotations.total, 0)
          ELSE 0
        END
      ),
      0
    )::NUMERIC AS total_quoted_this_month
  FROM current_user_context
  LEFT JOIN public.quotations
    ON quotations.user_id = current_user_context.user_id
  WHERE current_user_context.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_quotation_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_quotation_metrics() TO authenticated;

-- Storage: folders use profile UUID, not Clerk id
DROP POLICY IF EXISTS "Users manage own business assets" ON storage.objects;
CREATE POLICY "Users manage own business assets"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'business-assets'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'business-assets'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users manage own quotation attachments" ON storage.objects;
CREATE POLICY "Users manage own quotation attachments"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'quotation-attachments'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'quotation-attachments'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users manage own invoice uploads" ON storage.objects;
CREATE POLICY "Users manage own invoice uploads"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'invoice-uploads'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'invoice-uploads'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users manage own quotation pdfs" ON storage.objects;
CREATE POLICY "Users manage own quotation pdfs"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'quotation-pdfs'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'quotation-pdfs'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users manage own expense receipts" ON storage.objects;
CREATE POLICY "Users manage own expense receipts"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users manage own avatars" ON storage.objects;
CREATE POLICY "Users manage own avatars"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND public.current_profile_id()::text = (storage.foldername(name))[1]
);
