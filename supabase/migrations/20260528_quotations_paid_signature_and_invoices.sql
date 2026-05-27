ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signature_url TEXT;

CREATE TABLE public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'issued',
  notes TEXT,
  subtotal DECIMAL(10, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  valid_until DATE,
  pdf_path TEXT,
  pdf_generated_at TIMESTAMPTZ,
  share_token TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  signature_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, invoice_number)
);

CREATE TABLE public.invoice_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  catalog_item_id UUID REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit TEXT DEFAULT 'unidad',
  unit_price DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0
);

CREATE INDEX invoices_user_id_created_at_idx ON public.invoices (user_id, created_at DESC);
CREATE INDEX invoice_items_invoice_id_idx ON public.invoice_items (invoice_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own invoices"
ON public.invoices
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own invoice items"
ON public.invoice_items
FOR ALL
USING (
  auth.uid() = (
    SELECT user_id FROM public.invoices WHERE id = invoice_id
  )
)
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM public.invoices WHERE id = invoice_id
  )
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('quotation-signatures', 'quotation-signatures', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users manage own quotation signatures"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'quotation-signatures'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'quotation-signatures'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
