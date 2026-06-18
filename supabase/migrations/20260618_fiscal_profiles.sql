-- Datos fiscales (Argentina). Keyea por clerk_user_id (no profile UUID), igual
-- que la policy. RLS usa public.clerk_user_id() (= auth.jwt()->>'sub'); esta app
-- NO usa current_setting('app.current_user_id').

create table if not exists public.fiscal_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  cuit text not null,
  contributor_type text not null
    check (contributor_type in ('monotributista', 'responsable_inscripto')),
  sales_point text not null,
  business_name text not null,
  cert_path text,
  key_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fiscal_profiles enable row level security;

drop policy if exists "Users manage their own fiscal profile" on public.fiscal_profiles;
create policy "Users manage their own fiscal profile"
  on public.fiscal_profiles
  for all
  to authenticated
  using (clerk_user_id = public.clerk_user_id())
  with check (clerk_user_id = public.clerk_user_id());

-- Bucket privado para cert/key.
insert into storage.buckets (id, name, public)
values ('fiscal', 'fiscal', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own fiscal credentials" on storage.objects;
create policy "Users manage their own fiscal credentials"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'fiscal'
    and (storage.foldername(name))[1] = public.clerk_user_id()
  )
  with check (
    bucket_id = 'fiscal'
    and (storage.foldername(name))[1] = public.clerk_user_id()
  );
