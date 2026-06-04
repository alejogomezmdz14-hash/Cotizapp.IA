-- Idempotent repair: profiles RLS must use Clerk JWT (auth.jwt()->>'sub'), not auth.uid().

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clerk_id TEXT;

CREATE OR REPLACE FUNCTION public.clerk_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.jwt()->>'sub';
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM public.profiles
  WHERE clerk_id = public.clerk_user_id()
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (clerk_id = public.clerk_user_id())
  WITH CHECK (clerk_id = public.clerk_user_id());
