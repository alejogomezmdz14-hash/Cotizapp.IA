CREATE OR REPLACE FUNCTION public.get_dashboard_quotation_metrics()
RETURNS TABLE (
  quotations BIGINT,
  sent_quotations BIGINT,
  accepted_quotations BIGINT,
  pending_quotations BIGINT,
  total_quoted_this_month NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH current_user_context AS (
    SELECT
      auth.uid() AS user_id,
      (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS month_start,
      ((date_trunc('month', now() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC') AS next_month_start
  )
  SELECT
    COUNT(quotations.id)::BIGINT AS quotations,
    COUNT(quotations.id) FILTER (
      WHERE quotations.sent_at IS NOT NULL
    )::BIGINT AS sent_quotations,
    COUNT(quotations.id) FILTER (
      WHERE lower(btrim(COALESCE(quotations.status, ''))) IN ('accepted', 'approved')
    )::BIGINT AS accepted_quotations,
    COUNT(quotations.id) FILTER (
      WHERE lower(btrim(COALESCE(quotations.status, ''))) IN ('pending', 'sent')
    )::BIGINT AS pending_quotations,
    COALESCE(
      SUM(
        CASE
          WHEN quotations.created_at >= current_user_context.month_start
            AND quotations.created_at < current_user_context.next_month_start
          THEN COALESCE(quotations.total, 0)
          ELSE 0
        END
      ),
      0
    )::NUMERIC AS total_quoted_this_month
  FROM current_user_context
  LEFT JOIN public.quotations
    ON quotations.user_id = current_user_context.user_id
  WHERE current_user_context.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_quotation_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_quotation_metrics() TO authenticated;
