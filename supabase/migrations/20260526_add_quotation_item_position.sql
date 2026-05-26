ALTER TABLE public.quotation_items
  ADD COLUMN position INTEGER;

WITH ranked_items AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY quotation_id
      ORDER BY id
    ) - 1 AS normalized_position
  FROM public.quotation_items
)
UPDATE public.quotation_items AS quotation_items
SET position = ranked_items.normalized_position
FROM ranked_items
WHERE quotation_items.id = ranked_items.id;

ALTER TABLE public.quotation_items
  ALTER COLUMN position SET DEFAULT 0,
  ALTER COLUMN position SET NOT NULL;

CREATE INDEX quotation_items_quotation_id_position_idx
  ON public.quotation_items (quotation_id, position);
