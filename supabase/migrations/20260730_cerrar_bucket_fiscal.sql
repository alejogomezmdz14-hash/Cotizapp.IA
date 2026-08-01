-- Cierra el bucket `fiscal`. La policy anterior era `for all to authenticated`,
-- y `for all` INCLUYE SELECT: como el anon key y el JWT de Clerk están los dos en
-- el navegador, la clave privada fiscal era descargable desde JavaScript del
-- cliente. El material ya vive cifrado en public.fiscal_credentials.
--
-- CUÁNDO CORRERLA. Hay dos caminos, y en los dos esta migración va AL FINAL:
--
--   a) Rehacer el certificado con el wizard (recomendado mientras haya pocos
--      usuarios): desplegar el código nuevo, completar el wizard, emitir una
--      factura real de prueba, y recién ahí correr esto.
--   b) Migrar el material viejo: correr scripts/migrar-credenciales-fiscales.ts
--      --aplicar y esperar "fallidos: 0" y "Barrido final OK".
--
-- Nunca antes de desplegar el código nuevo: esta migración borra cert_path y
-- key_path, y el código viejo los lee para decidir si mostrar el botón de
-- facturar. Correrla antes deja ese botón invisible sin ningún mensaje.
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).
--
-- En una transacción: si el `alter table` de abajo fallara, no queremos que
-- la policy quede dropeada mientras las columnas de paths siguen ahí (ese
-- estado a mitad de camino es peor que no haber corrido nada).

begin;

drop policy if exists "Users manage their own fiscal credentials" on storage.objects;

-- Sin policy para `authenticated`: el bucket `fiscal` queda inaccesible desde el
-- navegador. Lo que quede adentro (certificados, no sensibles) solo se toca con
-- service_role desde el servidor.

-- Los paths dejan de ser autoridad: la fuente de verdad es fiscal_credentials.
alter table public.fiscal_profiles
  drop column if exists cert_path,
  drop column if exists key_path;

commit;
