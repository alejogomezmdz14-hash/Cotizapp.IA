ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.quotation_attachments
  DROP CONSTRAINT IF EXISTS quotation_attachments_quotation_id_fkey;

ALTER TABLE public.quotation_attachments
  ADD CONSTRAINT quotation_attachments_quotation_id_user_id_fkey
  FOREIGN KEY (quotation_id, user_id)
  REFERENCES public.quotations (id, user_id)
  ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users manage own quotation attachments"
  ON public.quotation_attachments;

CREATE POLICY "Users manage own quotation attachments"
  ON public.quotation_attachments
  FOR ALL
  USING (
    auth.uid() = user_id
    AND auth.uid() = (
      SELECT user_id
      FROM public.quotations
      WHERE id = quotation_id
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = (
      SELECT user_id
      FROM public.quotations
      WHERE id = quotation_id
    )
  );
