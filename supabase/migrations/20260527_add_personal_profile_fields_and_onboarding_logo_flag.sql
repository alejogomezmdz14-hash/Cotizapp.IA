alter table public.profiles
add column if not exists first_name text,
add column if not exists last_name text,
add column if not exists country text,
add column if not exists city text,
add column if not exists birth_date date,
add column if not exists avatar_url text,
add column if not exists logo_onboarding_completed boolean not null default false;

-- No bloquear usuarios existentes que ya estaban pudiendo usar el panel.
update public.profiles
set logo_onboarding_completed = true
where coalesce(nullif(trim(business_name), ''), '') <> ''
  and coalesce(nullif(trim(industry), ''), '') <> '';
