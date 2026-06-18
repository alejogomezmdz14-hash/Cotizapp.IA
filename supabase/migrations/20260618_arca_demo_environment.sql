-- Permite el entorno 'demo' (simulación sin ARCA) en fiscal_profiles, para probar
-- el flujo de facturación end-to-end sin certificado ni Clave Fiscal.
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

alter table public.fiscal_profiles
  drop constraint if exists fiscal_profiles_environment_check;

alter table public.fiscal_profiles
  add constraint fiscal_profiles_environment_check
    check (environment in ('homologacion', 'produccion', 'demo'));
