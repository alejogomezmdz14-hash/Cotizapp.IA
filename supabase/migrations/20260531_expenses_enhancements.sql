ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS receipt_path TEXT;

ALTER TABLE public.expenses
ALTER COLUMN currency SET DEFAULT 'ARS';

UPDATE public.expenses
SET receipt_path = receipt_url
WHERE receipt_path IS NULL
  AND receipt_url IS NOT NULL;
