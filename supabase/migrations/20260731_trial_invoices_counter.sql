-- Cupo gratis de facturas electrónicas emitidas. Mismo patrón que los contadores
-- de cotizaciones y escaneos: monótono, por perfil, sin reseteo mensual.
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

alter table public.profiles
  add column if not exists trial_invoices_used integer not null default 0;
