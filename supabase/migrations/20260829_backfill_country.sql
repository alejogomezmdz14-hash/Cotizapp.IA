-- Los usuarios que completaron el onboarding ANTES de que existiera el campo
-- País quedaron con country = null, y todo el módulo fiscal está detrás de
-- isArgentina(country). O sea: para ellos la facturación electrónica es
-- invisible y no tienen forma de saber por qué.
--
-- Cotizapp es un producto argentino: emite Factura C contra ARCA, en pesos.
-- Asumir Argentina para las filas sin país es correcto y reversible (el usuario
-- puede cambiarlo desde su perfil).
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

update public.profiles
  set country = 'Argentina'
  where country is null or btrim(country) = '';
