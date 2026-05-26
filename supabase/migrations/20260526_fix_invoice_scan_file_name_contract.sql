ALTER TABLE public.invoice_scans
  ADD COLUMN IF NOT EXISTS file_name TEXT;
