-- Reliable Clerk profile bootstrap: link legacy rows by email or insert new profile.

CREATE OR REPLACE FUNCTION public.ensure_clerk_profile(
  p_clerk_id text,
  p_email text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_sub text;
  result public.profiles;
  normalized_email text;
BEGIN
  jwt_sub := auth.jwt()->>'sub';

  IF jwt_sub IS NULL OR jwt_sub <> p_clerk_id THEN
    RAISE EXCEPTION 'No autorizado para este perfil';
  END IF;

  SELECT * INTO result
  FROM public.profiles
  WHERE clerk_id = p_clerk_id
  LIMIT 1;

  IF FOUND THEN
    RETURN result;
  END IF;

  normalized_email := NULLIF(lower(trim(p_email)), '');

  IF normalized_email IS NOT NULL THEN
    UPDATE public.profiles
    SET
      clerk_id = p_clerk_id,
      email = COALESCE(email, p_email)
    WHERE clerk_id IS NULL
      AND email IS NOT NULL
      AND lower(trim(email)) = normalized_email
    RETURNING * INTO result;

    IF FOUND THEN
      RETURN result;
    END IF;
  END IF;

  INSERT INTO public.profiles (clerk_id, email, logo_onboarding_completed)
  VALUES (p_clerk_id, p_email, false)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_clerk_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_clerk_profile(text, text) TO authenticated;
