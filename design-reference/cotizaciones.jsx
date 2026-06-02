// cotizaciones.jsx — Lista + Detalle

function Cotizaciones({ onOpen }) {
  const [tab, setTab] = React.useState("todas");
  const [q, setQ] = React.useState("");

  const filtered = COTIZACIONES.filter(c => {
    if (tab !== "todas" && c.estado !== tab) return false;
    if (q && !(c.cliente.name.toLowerCase().includes(q.toLowerCase()) || c.id.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const tabs = [
    { id: "todas",     label: "Todas",     count: COUNTS.todas },
    { id: "borrador",  label: "Borradores",count: COUNTS.borrador },
    { id: "enviada",   label: "Enviadas",  count: COUNTS.enviada },
    { id: "aceptada",  label: "Aceptadas", count: COUNTS.aceptada },
    { id: "rechazada", label: "Rechazadas",count: COUNTS.rechazada },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cotizaciones</h1>
          <div className="page-subtitle">8 documentos · 4 con monto cobrable · última actividad hace 2 horas</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">Exportar CSV</button>
          <button className="btn btn-primary btn-lg" type="button" onClick={() => onOpen("nueva")}>Nueva cotización</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}<span className="count">{t.count}</span>
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", paddingBottom: 6 }}>
          <div className="search" style={{ width: 240, marginLeft: 0 }}>
            <svg width="13" height="13" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" className="icon-stroke" /><path d="M9.5 9.5 L12 12" className="icon-stroke" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente o número…" />
          </div>
        </div>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 110 }}>Número</th>
            <th>Cliente</th>
            <th style={{ width: 130 }}>Emitida</th>
            <th style={{ width: 130 }}>Vence</th>
            <th style={{ width: 110 }}>Estado</th>
            <th className="num" style={{ width: 140 }}>Monto</th>
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => {
            const days = c.estado === "enviada" ? Math.floor(Math.random() * 5 + 1) : null;
            return (
              <tr key={c.id} onClick={() => onOpen("detalle", c.id)}>
                <td><span className="cell-id">{c.id}</span></td>
                <td>
                  <div className="av-row">
                    <span className="av">{c.cliente.initials}</span>
                    <div>
                      <div className="cell-name">{c.cliente.name}</div>
                      <div className="cell-sub">{c.cliente.contacto}</div>
                    </div>
                  </div>
                </td>
                <td className="cell-sub">{c.fechaEmision}</td>
                <td className="cell-sub">{c.vence}</td>
                <td><Tag kind={c.estado} /></td>
                <td className="num mono">{ARS(c.monto)}</td>
                <td style={{ textAlign: "right", color: "var(--fg-4)" }}>→</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>
          Nada por acá. Probá con otro filtro o cambiá la búsqueda.
        </div>
      )}
    </div>
  );
}

// ====== DETALLE ======
function CotizacionDetalle({ id, onBack, onOpen }) {
  const c = COTIZACIONES.find(x => x.id === id) || COTIZACIONES[1]; // default to COT-0240

  const subtotal = c.items.reduce((a, it) => a + it.q * it.p, 0);
  const iva = Math.round(subtotal * 0.21);
  const total = subtotal + iva;

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onOpen("cotizaciones")}>
          ← Cotizaciones
        </button>
      </div>

      <div className="page-header" style={{ alignItems: "center" }}>
        <div>
          <div className="kicker">Cotización <span className="mono" style={{ color: "var(--fg-2)" }}>{c.id}</span></div>
          <h1 className="page-title" style={{ marginTop: 6 }}>{c.cliente.name}</h1>
          <div className="page-subtitle" style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <Tag kind={c.estado} />
            <span style={{ color: "var(--fg-4)" }}>·</span>
            <span>Emitida {c.fechaEmision}</span>
            <span style={{ color: "var(--fg-4)" }}>·</span>
            <span>Vence {c.vence}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">Descargar PDF</button>
          <button className="btn" type="button">Duplicar</button>
          <button className="btn btn-primary" type="button">Enviar por WhatsApp</button>
        </div>
      </div>

      <div className="detail">
        <div className="invoice">
          <div className="invoice-head">
            <div>
              <div className="invoice-title">Presupuesto</div>
              <div className="invoice-id">{c.id} · v2</div>
            </div>
            <div className="invoice-meta">
              <div className="row"><span>Emitida</span><span className="v">{c.fechaEmision}</span></div>
              <div className="row"><span>Válida hasta</span><span className="v">{c.vence}</span></div>
              <div className="row"><span>Moneda</span><span className="v">ARS</span></div>
            </div>
          </div>

          <div className="party">
            <div>
              <div className="lbl">De</div>
              <div className="name">Promat</div>
              <div className="det">Nicolás Herrera<br />Monotributo categoría B<br />CUIT 20-32849181-4<br />Av. Corrientes 1248, CABA</div>
            </div>
            <div>
              <div className="lbl">Para</div>
              <div className="name">{c.cliente.name}</div>
              <div className="det">{c.cliente.contacto}<br />{c.cliente.email}<br /></div>
            </div>
          </div>

          <table className="items">
            <thead>
              <tr>
                <th style={{ width: 24 }}>#</th>
                <th>Descripción</th>
                <th className="num" style={{ width: 60 }}>Cant.</th>
                <th className="num" style={{ width: 140 }}>P. unit.</th>
                <th className="num" style={{ width: 140 }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it, i) => (
                <tr key={i}>
                  <td className="mono" style={{ color: "var(--fg-4)" }}>{String(i + 1).padStart(2, "0")}</td>
                  <td style={{ paddingRight: 20 }}>{it.d}</td>
                  <td className="num">{it.q}</td>
                  <td className="num">{ARS(it.p)}</td>
                  <td className="num">{ARS(it.q * it.p)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td></td><td></td><td></td>
                <td style={{ color: "var(--fg-3)", textAlign: "right" }}>Subtotal</td>
                <td className="num">{ARS(subtotal)}</td>
              </tr>
              <tr>
                <td></td><td></td><td></td>
                <td style={{ color: "var(--fg-3)", textAlign: "right" }}>IVA 21%</td>
                <td className="num">{ARS(iva)}</td>
              </tr>
              <tr className="total">
                <td></td><td></td><td></td>
                <td style={{ textAlign: "right" }}>Total ARS</td>
                <td className="num">{ARS(total)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--fg-3)", lineHeight: 1.6 }}>
            <div className="lbl" style={{ fontSize: 10.5, color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Condiciones</div>
            Precios en pesos argentinos. Cotización válida por 30 días corridos desde la emisión.
            Forma de pago: 50% al confirmar, 50% contra entrega. Transferencia bancaria o Mercado Pago.
            Para iniciar el trabajo se requiere aceptación por escrito y pago de seña.
          </div>
        </div>

        <div>
          <div className="aside-card">
            <h4>Estado de la cotización</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
              {[
                { l: "Creada", v: "24 May · 16:08", done: true },
                { l: "Enviada por WhatsApp", v: "24 May · 16:10", done: true },
                { l: "Vista por cliente", v: "25 May · 09:42 (3 veces)", done: true },
                { l: "Aceptada", v: "Esperando…", done: false },
                { l: "Cobrada", v: "—", done: false },
              ].map((s, i, arr) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ position: "relative", marginTop: 3 }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.done ? "var(--mint)" : "transparent", border: "1px solid " + (s.done ? "var(--mint)" : "var(--line-2)") }}></div>
                    {i < arr.length - 1 && (
                      <div style={{ position: "absolute", top: 11, left: 4, width: 1, height: 22, background: "var(--line)" }}></div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: s.done ? "var(--fg)" : "var(--fg-3)" }}>{s.l}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>{s.v}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="aside-card">
            <h4>Acciones rápidas</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn" type="button" style={{ justifyContent: "flex-start", width: "100%" }}>Marcar como aceptada</button>
              <button className="btn" type="button" style={{ justifyContent: "flex-start", width: "100%" }}>Reenviar a {c.cliente.contacto.split(" ")[0]}</button>
              <button className="btn" type="button" style={{ justifyContent: "flex-start", width: "100%" }}>Copiar link público</button>
              <button className="btn" type="button" style={{ justifyContent: "flex-start", width: "100%" }}>Convertir a factura</button>
            </div>
          </div>

          <div className="aside-card">
            <h4>Cliente</h4>
            <div className="av-row" style={{ marginBottom: 10 }}>
              <span className="av" style={{ width: 32, height: 32, fontSize: 12 }}>{c.cliente.initials}</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{c.cliente.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>{c.cliente.contacto}</div>
              </div>
            </div>
            <div className="aside-row"><span className="l">Email</span><span className="v" style={{ fontSize: 11, color: "var(--fg-2)" }}>{c.cliente.email}</span></div>
            <div className="aside-row"><span className="l">Cotizado total</span><span className="v">ARS {ARS(3870500)}</span></div>
            <div className="aside-row"><span className="l">Documentos</span><span className="v">3</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Cotizaciones, CotizacionDetalle });
