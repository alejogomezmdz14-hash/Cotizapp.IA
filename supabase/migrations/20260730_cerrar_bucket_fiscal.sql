-- Cierra el bucket `fiscal`. La policy anterior era `for all to authenticated`,
-- y `for all` INCLUYE SELECT: como el anon key y el JWT de Clerk están los dos en
-- el navegador, la clave privada fiscal era descargable desde JavaScript del
-- cliente. El material ya vive cifrado en public.fiscal_credentials.
--
-- Correr SOLO después de que scripts/migrar-credenciales-fiscales.ts --aplicar
-- haya terminado con "fallidos: 0" y "Barrido final OK".
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

drop policy if exists "Users manage their own fiscal credentials" on storage.objects;

-- Sin policy para `authenticated`: el bucket `fiscal` queda inaccesible desde el
-- navegador. Lo que quede adentro (certificados, no sensibles) solo se toca con
-- service_role desde el servidor.

-- Los paths dejan de ser autoridad: la fuente de verdad es fiscal_credentials.
alter table public.fiscal_profiles
  drop column if exists cert_path,
  drop column if exists key_path;
