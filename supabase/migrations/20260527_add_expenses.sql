CREATE TABLE public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',
  category TEXT NOT NULL,
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX expenses_user_id_date_idx ON public.expenses (user_id, date DESC);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own expenses"
ON public.expenses
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users manage own expense receipts"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'expense-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE OR REPLACE FUNCTION public.get_accepted_quoted_this_month()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(COALESCE(quotations.total, 0)),
    0
  )::NUMERIC
  FROM public.quotations
  WHERE quotations.user_id = auth.uid()
    AND lower(btrim(COALESCE(quotations.status, ''))) IN ('accepted', 'approved')
    AND quotations.created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    AND quotations.created_at < ((date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC');
$$;

REVOKE ALL ON FUNCTION public.get_accepted_quoted_this_month() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accepted_quoted_this_month() TO authenticated;
