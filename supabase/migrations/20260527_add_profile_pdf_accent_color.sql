ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pdf_accent_color TEXT DEFAULT '#3B82F6';
