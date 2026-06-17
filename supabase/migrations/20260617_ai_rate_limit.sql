-- Rate-limit durable para los endpoints de IA (chat, escaneo de visión, audio).
--
-- Reemplaza el limiter en memoria (Map por instancia, se reiniciaba en cada
-- cold start de Vercel y no limitaba de verdad entre instancias). El conteo
-- ahora vive acá y el RPC consume_ai_rate_limit lo actualiza de forma atómica
-- (SELECT ... FOR UPDATE) keyeando por el "sub" del JWT de Clerk.

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  subject text NOT NULL,
  scope text NOT NULL,
  minute_count integer NOT NULL DEFAULT 0,
  minute_window_start timestamptz NOT NULL DEFAULT now(),
  day_count integer NOT NULL DEFAULT 0,
  day_window_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, scope)
);

-- RLS activado pero SIN políticas: la tabla solo es accesible a través del
-- RPC SECURITY DEFINER de abajo (que corre como owner y saltea RLS). Ningún
-- cliente authenticated/anon puede leerla ni escribirla directamente.
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
  p_scope text,
  p_max_per_minute integer,
  p_max_per_day integer
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  retry_seconds integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject text := public.clerk_user_id();
  v_now timestamptz := now();
  v_minute_window constant interval := make_interval(secs => 60);
  v_day_window constant interval := make_interval(secs => 86400);
  v_minute_count integer;
  v_minute_start timestamptz;
  v_day_count integer;
  v_day_start timestamptz;
BEGIN
  -- Sin identidad en el JWT: la capa de ruta ya exige sesión, así que dejamos
  -- pasar (no podemos keyear de forma confiable un pedido sin "sub").
  IF v_subject IS NULL OR btrim(v_subject) = '' THEN
    RETURN QUERY SELECT true, NULL::text, NULL::integer;
    RETURN;
  END IF;

  INSERT INTO public.ai_rate_limits AS arl (
    subject, scope, minute_count, minute_window_start,
    day_count, day_window_start, updated_at
  )
  VALUES (v_subject, p_scope, 0, v_now, 0, v_now, v_now)
  ON CONFLICT (subject, scope) DO NOTHING;

  SELECT arl.minute_count, arl.minute_window_start, arl.day_count, arl.day_window_start
    INTO v_minute_count, v_minute_start, v_day_count, v_day_start
  FROM public.ai_rate_limits arl
  WHERE arl.subject = v_subject AND arl.scope = p_scope
  FOR UPDATE;

  -- Reiniciar las ventanas que ya expiraron.
  IF v_now - v_minute_start >= v_minute_window THEN
    v_minute_count := 0;
    v_minute_start := v_now;
  END IF;

  IF v_now - v_day_start >= v_day_window THEN
    v_day_count := 0;
    v_day_start := v_now;
  END IF;

  -- Tope por minuto.
  IF v_minute_count >= p_max_per_minute THEN
    UPDATE public.ai_rate_limits arl
      SET minute_count = v_minute_count,
          minute_window_start = v_minute_start,
          day_count = v_day_count,
          day_window_start = v_day_start,
          updated_at = v_now
    WHERE arl.subject = v_subject AND arl.scope = p_scope;

    RETURN QUERY SELECT
      false,
      'per_minute'::text,
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (v_minute_start + v_minute_window - v_now)))::integer
      );
    RETURN;
  END IF;

  -- Tope por día.
  IF v_day_count >= p_max_per_day THEN
    UPDATE public.ai_rate_limits arl
      SET minute_count = v_minute_count,
          minute_window_start = v_minute_start,
          day_count = v_day_count,
          day_window_start = v_day_start,
          updated_at = v_now
    WHERE arl.subject = v_subject AND arl.scope = p_scope;

    RETURN QUERY SELECT
      false,
      'per_day'::text,
      GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (v_day_start + v_day_window - v_now)))::integer
      );
    RETURN;
  END IF;

  -- Permitido: consumimos un token de ambas ventanas.
  UPDATE public.ai_rate_limits arl
    SET minute_count = v_minute_count + 1,
        minute_window_start = v_minute_start,
        day_count = v_day_count + 1,
        day_window_start = v_day_start,
        updated_at = v_now
  WHERE arl.subject = v_subject AND arl.scope = p_scope;

  RETURN QUERY SELECT true, NULL::text, NULL::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(text, integer, integer) TO authenticated;
