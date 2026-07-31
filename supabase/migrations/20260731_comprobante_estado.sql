-- Integridad del comprobante electrónico.
--
-- cbte_nro: el número que se reserva ANTES de llamar a ARCA. Sin esto, si la
--   respuesta se pierde por un timeout no hay forma de preguntarle a ARCA si el
--   comprobante existe, y el reintento emite una segunda factura real.
-- cbte_fch: la fecha EXACTA que se le informó a ARCA, en horario argentino. El
--   PDF y el QR la leen de acá en vez de recalcularla, para que los tres digan
--   siempre lo mismo.
-- factura_estado: 'reservado' | 'emitido' | 'en_revision' | 'descartado'.
--   'en_revision' es el caso en que no sabemos si ARCA emitió o no.
--
-- Se aplica a mano en el SQL Editor del Dashboard (proyecto cotizapp-ia).

alter table public.quotations
  add column if not exists cbte_nro integer,
  add column if not exists cbte_fch date,
  add column if not exists factura_estado text
    check (factura_estado in ('reservado','emitido','en_revision','descartado'));

-- Correlatividad por punto de venta: dos comprobantes del mismo usuario no
-- pueden compartir número. Parcial, porque solo aplica a los que llegaron a
-- reservar uno.
create unique index if not exists quotations_cbte_nro_por_usuario
  on public.quotations (user_id, cbte_nro)
  where cbte_nro is not null and factura_estado <> 'descartado';

-- Las filas ya facturadas antes de esta migración quedan como emitidas.
update public.quotations
  set factura_estado = 'emitido'
  where cae is not null and factura_estado is null;
