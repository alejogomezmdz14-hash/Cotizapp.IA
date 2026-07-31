-- Tickets de acceso WSAA de ARCA. Antes se cacheaban en /tmp con un nombre de
-- archivo keyeado por CUIT (TA-{cuit}-{servicio}.json), y en Vercel /tmp se
-- comparte entre invocaciones de usuarios distintos en la misma instancia tibia.
-- Como el CUIT era un campo de formulario, eso permitía que un usuario reusara
-- el ticket de otro y emitiera facturas reales a su nombre. Acá la clave es
-- clerk_user_id y nunca el CUIT.
--
-- El ticket (token + sign) es una credencial portadora: con ella se emite durante
-- ~12 h SIN la clave privada. Por eso se guarda cifrado con el mismo sobre
-- AES-256-GCM que la clave, y la tabla tiene RLS de negación total: RLS activo,
-- ninguna policy, y revoke explícito. Solo se accede con service_role.
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

create table if not exists public.arca_tickets (
  clerk_user_id     text not null,
  service_name      text not null,
  environment       text not null
    check (environment in ('homologacion', 'produccion')),
  -- Sobre AES-256-GCM en base64 del JSON { header, credentials } que devuelve
  -- WSAA. Se guarda entero porque AccessTicket.create() necesita el header:
  -- ahí viene el expirationtime, y sin él el ticket no se puede reconstruir.
  credentials_enc   text not null,
  expires_at        timestamptz not null,
  key_id            smallint not null default 1,
  updated_at        timestamptz not null default now(),
  primary key (clerk_user_id, service_name, environment)
);

alter table public.arca_tickets enable row level security;

revoke all on public.arca_tickets from authenticated, anon;

-- Para limpiar vencidos sin escanear la tabla entera.
create index if not exists arca_tickets_expires_at
  on public.arca_tickets (expires_at);
