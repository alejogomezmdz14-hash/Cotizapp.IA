ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS quotation_numbering_mode TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS quotation_prefix TEXT DEFAULT 'COT',
ADD COLUMN IF NOT EXISTS quotation_counter INTEGER DEFAULT 1;
