-- Fixes de la auditoría end-to-end (2026-06-26).
-- Aplicar manualmente en el SQL Editor del proyecto cotizapp-ia.

-- 1) Numeración secuencial atómica: evita números de cotización duplicados
--    cuando dos creaciones corren a la vez (read-modify-write era la carrera).
--    Devuelve el número reservado (el valor ANTES de incrementar).
CREATE OR REPLACE FUNCTION public.reserve_quotation_counter(profile_id uuid)
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET quotation_counter = GREATEST(1, COALESCE(quotation_counter, 1)) + 1
  WHERE id = profile_id
  RETURNING quotation_counter - 1;
$$;

REVOKE ALL ON FUNCTION public.reserve_quotation_counter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_quotation_counter(uuid) TO authenticated;

-- 2) get_accepted_quoted_this_month usaba auth.uid(), que bajo Clerk es NULL
--    (devolvía siempre 0). Reescrito con current_profile_id(), igual que el
--    resto de las políticas/funciones post-Clerk.
CREATE OR REPLACE FUNCTION public.get_accepted_quoted_this_month()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(COALESCE(quotations.total, 0)),
    0
  )::NUMERIC
  FROM public.quotations
  WHERE quotations.user_id = public.current_profile_id()
    AND lower(btrim(COALESCE(quotations.status, ''))) IN ('accepted', 'approved')
    AND quotations.created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    AND quotations.created_at < ((date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC');
$$;

REVOKE ALL ON FUNCTION public.get_accepted_quoted_this_month() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accepted_quoted_this_month() TO authenticated;
