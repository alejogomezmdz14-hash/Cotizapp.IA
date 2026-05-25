ALTER TABLE public.catalog_items
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.clients
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.quotations
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.quotation_items
  ALTER COLUMN quotation_id SET NOT NULL;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.quotations
  DROP CONSTRAINT quotations_client_id_fkey;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_client_id_user_id_fkey
  FOREIGN KEY (client_id, user_id)
  REFERENCES public.clients (id, user_id);
