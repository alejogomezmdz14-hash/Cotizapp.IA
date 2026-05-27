ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pdf_template TEXT DEFAULT 'classic';
