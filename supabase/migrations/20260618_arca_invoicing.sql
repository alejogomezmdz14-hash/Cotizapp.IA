-- Emisión de factura electrónica ARCA. Extiende fiscal_profiles con el entorno
-- (homologación/producción) y agrega los campos de CAE a quotations.
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

alter table public.fiscal_profiles
  add column if not exists environment text not null default 'homologacion'
    check (environment in ('homologacion', 'produccion'));

alter table public.quotations
  add column if not exists cae text,
  add column if not exists cae_vencimiento date,
  add column if not exists numero_factura text,
  add column if not exists facturado_at timestamptz;
