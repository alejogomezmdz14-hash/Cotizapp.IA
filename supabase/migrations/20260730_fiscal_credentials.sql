-- Credenciales fiscales de ARCA (Camino 1). La clave privada se guarda CIFRADA
-- con AES-256-GCM y el CUIT se extrae del certificado, no del formulario.
--
-- RLS de negación total: la tabla tiene RLS activo y NINGUNA policy, así que el
-- rol `authenticated` no ve nada. Solo se accede con service_role desde el
-- servidor. Esto es deliberado: el material fiscal no debe ser alcanzable con el
-- anon key + el JWT de Clerk, que están los dos en el navegador.
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

create table if not exists public.fiscal_credentials (
  clerk_user_id       text primary key,
  cuit                text not null,
  -- El sobre AES-256-GCM completo, en base64. Es `text` y no `bytea` a
  -- propósito: PostgREST transporta JSON, así que un bytea vuelve como string
  -- hexadecimal "\x..." al leer y no acepta un Buffer al escribir. Base64 sobre
  -- text es inequívoco en las dos direcciones y no pierde nada, porque el sobre
  -- ya es un blob binario autodescriptivo.
  private_key_enc     text not null,
  cert_pem            text,
  cert_serial         text,
  cert_not_after      timestamptz,
  key_id              smallint not null default 1,
  csr_pem             text,
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.fiscal_credentials enable row level security;

revoke all on public.fiscal_credentials from authenticated, anon;

-- Un CUIT verificado pertenece a una sola cuenta.
create unique index if not exists fiscal_credentials_cuit_verificado
  on public.fiscal_credentials (cuit)
  where verified_at is not null;
