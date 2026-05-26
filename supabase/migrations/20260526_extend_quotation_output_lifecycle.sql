ALTER TABLE public.quotations
  ADD COLUMN pdf_path TEXT,
  ADD COLUMN pdf_generated_at TIMESTAMPTZ,
  ADD COLUMN share_token TEXT,
  ADD COLUMN sent_at TIMESTAMPTZ;

UPDATE public.quotations
SET status = CASE lower(trim(coalesce(status, '')))
  WHEN '' THEN 'draft'
  WHEN 'draft' THEN 'draft'
  WHEN 'sent' THEN 'pending'
  WHEN 'pending' THEN 'pending'
  WHEN 'approved' THEN 'accepted'
  WHEN 'accepted' THEN 'accepted'
  WHEN 'rejected' THEN 'rejected'
  WHEN 'expired' THEN 'expired'
  ELSE 'draft'
END;

ALTER TABLE public.quotations
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_status_check
  CHECK (status IN ('draft', 'pending', 'accepted', 'rejected', 'expired'));

CREATE UNIQUE INDEX quotations_share_token_key
  ON public.quotations (share_token)
  WHERE share_token IS NOT NULL;

ALTER TABLE public.quotation_items
  ADD COLUMN catalog_item_id UUID REFERENCES public.catalog_items(id);

CREATE INDEX quotation_items_catalog_item_id_idx
  ON public.quotation_items (catalog_item_id);
