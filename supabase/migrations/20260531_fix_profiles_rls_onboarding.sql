-- Ensure profile upserts from onboarding pass RLS on insert and update.
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;

CREATE POLICY "Users manage own profile"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
