// nueva.jsx — Nueva cotización (flujo)

function Nueva({ onOpen }) {
  const [step, setStep] = React.useState(1);
  const [cliente, setCliente] = React.useState(CLIENTES[0]);
  const [items, setItems] = React.useState([
    { d: "Diseño de identidad — manual de marca", q: 1, p: 680_000 },
    { d: "Sesión fotográfica — espacios de oficina", q: 1, p: 420_000 },
  ]);
  const [showCatalog, setShowCatalog] = React.useState(false);

  const subtotal = items.reduce((a, it) => a + (Number(it.q) || 0) * (Number(it.p) || 0), 0);
  const iva = Math.round(subtotal * 0.21);
  const total = subtotal + iva;

  const updateItem = (i, key, value) => {
    setItems(items.map((it, j) => j === i ? { ...it, [key]: value } : it));
  };
  const removeItem = (i) => setItems(items.filter((_, j) => j !== i));
  const addItem = () => setItems([...items, { d: "", q: 1, p: 0 }]);
  const addFromCatalog = (cat) => {
    setItems([...items, { d: cat.nombre, q: 1, p: cat.precio }]);
    setShowCatalog(false);
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => onOpen("cotizaciones")}>← Cotizaciones</button>
      </div>

      <div className="page-header">
        <div>
          <div className="kicker">Nueva · borrador automático</div>
          <h1 className="page-title">Cotización para {cliente.contacto.split(" ")[0]}</h1>
          <div className="page-subtitle">Se guarda solo a medida que escribís. Compartila cuando estés conforme.</div>
        </div>
        <div className="steps">
          <div className={"step " + (step >= 1 ? "done" : "")}><span className="num">1</span>Cliente</div>
          <span className="arr">›</span>
          <div className={"step " + (step === 2 ? "current" : step > 2 ? "done" : "")}><span className="num">2</span>Ítems</div>
          <span className="arr">›</span>
          <div className={"step " + (step === 3 ? "current" : "")}><span className="num">3</span>Revisar y enviar</div>
        </div>
      </div>

      {/* Cliente */}
      <div className="form-grid" style={{ marginBottom: 28 }}>
        <div className="field">
          <label>Cliente</label>
          <select value={cliente.name} onChange={(e) => setCliente(CLIENTES.find(c => c.name === e.target.value))}>
            {CLIENTES.map(c => <option key={c.name}>{c.name}</option>)}
          </select>
          <span className="field-hint">
            {cliente.contacto} · {cliente.email} · ya tiene {cliente.cotizados} cotizaciones cargadas
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="field">
            <label>Emitida</label>
            <input defaultValue="27 May 2026" />
          </div>
          <div className="field">
            <label>Vence</label>
            <input defaultValue="26 Jun 2026" />
            <span className="field-hint">+30 días corridos</span>
          </div>
        </div>
      </div>

      {/* Items editor */}
      <div className="section-head">
        <div className="section-title">Ítems</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" type="button" onClick={() => setShowCatalog(!showCatalog)}>+ Desde catálogo</button>
          <button className="btn btn-sm" type="button">+ Escanear factura</button>
          <button className="btn btn-sm" type="button" onClick={addItem}>+ Ítem manual</button>
        </div>
      </div>

      {showCatalog && (
        <div className="aside-card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="kicker">Catálogo · 8 ítems</div>
            <button className="btn-ghost btn-sm" type="button" onClick={() => setShowCatalog(false)} style={{ padding: "4px 8px", fontSize: 12, color: "var(--fg-3)" }}>Cerrar</button>
          </div>
          <table className="tbl">
            <tbody>
              {CATALOGO.slice(0, 5).map(cat => (
                <tr key={cat.sku} onClick={() => addFromCatalog(cat)}>
                  <td style={{ width: 80 }}><span className="cell-id">{cat.sku}</span></td>
                  <td>
                    <div className="cell-name">{cat.nombre}</div>
                    <div className="cell-sub">{cat.categoria} · usado en {cat.usado} cotizaciones</div>
                  </td>
                  <td className="num mono" style={{ width: 140 }}>ARS {ARS(cat.precio)}</td>
                  <td style={{ width: 32, textAlign: "right", color: "var(--mint)" }}>+</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="items-editor">
        <table className="tbl" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Descripción</th>
              <th className="num" style={{ width: 72 }}>Cant.</th>
              <th className="num" style={{ width: 160 }}>P. unitario</th>
              <th className="num" style={{ width: 160 }}>Subtotal</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ cursor: "default" }}>
                <td className="mono" style={{ color: "var(--fg-4)" }}>{String(i + 1).padStart(2, "0")}</td>
                <td>
                  <input
                    value={it.d}
                    onChange={(e) => updateItem(i, "d", e.target.value)}
                    placeholder="Describí el servicio…"
                  />
                </td>
                <td>
                  <input className="num" type="number" value={it.q} onChange={(e) => updateItem(i, "q", Number(e.target.value))} />
                </td>
                <td>
                  <input className="num" type="number" value={it.p} onChange={(e) => updateItem(i, "p", Number(e.target.value))} />
                </td>
                <td className="num mono">{ARS((Number(it.q) || 0) * (Number(it.p) || 0))}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn-ghost" type="button" onClick={() => removeItem(i)} style={{ color: "var(--fg-4)", padding: 4, fontSize: 14 }}>×</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="6" style={{ padding: 40, textAlign: "center", color: "var(--fg-3)" }}>
                Todavía no agregaste ítems. Empezá por catálogo o escribí uno a mano.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="totals-bar">
        <div className="totals-grid">
          <div className="tot">
            <span className="lbl">Subtotal</span>
            <span className="v">ARS {ARS(subtotal)}</span>
          </div>
          <div className="tot">
            <span className="lbl">IVA 21%</span>
            <span className="v">ARS {ARS(iva)}</span>
          </div>
          <div className="tot">
            <span className="lbl">Total</span>
            <span className="v total">ARS {ARS(total)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">Vista previa PDF</button>
          <button className="btn" type="button">Guardar borrador</button>
          <button className="btn btn-primary btn-lg" type="button">Enviar por WhatsApp</button>
        </div>
      </div>

      {/* Notas */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Notas para el cliente</div>
          <span className="section-meta">opcional · aparece al pie del PDF</span>
        </div>
        <div className="field">
          <textarea
            rows="3"
            defaultValue="Cotización válida por 30 días corridos. 50% al confirmar, 50% contra entrega. Aceptamos transferencia o Mercado Pago."
            style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px", fontSize: 13, resize: "vertical", lineHeight: 1.5, background: "rgba(255,255,255,0.02)" }}
          />
        </div>
      </div>
    </div>
  );
}

// ====== CLIENTES ======
function Clientes({ onOpen }) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <div className="page-subtitle">7 cargados · 4 activos este mes · ticket promedio ARS {ARS(1_750_000)}</div>
        </div>
        <button className="btn btn-primary" type="button">+ Nuevo cliente</button>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Contacto</th>
            <th className="num">Cotizaciones</th>
            <th className="num">Facturado total</th>
            <th>Última actividad</th>
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {CLIENTES.map((c) => (
            <tr key={c.name}>
              <td>
                <div className="av-row">
                  <span className="av">{c.initials}</span>
                  <div>
                    <div className="cell-name">{c.name}</div>
                    <div className="cell-sub">{c.tel}</div>
                  </div>
                </div>
              </td>
              <td>
                <div>{c.contacto}</div>
                <div className="cell-sub">{c.email}</div>
              </td>
              <td className="num mono">{c.cotizados}</td>
              <td className="num mono">{c.facturado === 0 ? <span style={{ color: "var(--fg-4)" }}>—</span> : "ARS " + ARS(c.facturado)}</td>
              <td className="cell-sub">{c.ultima}</td>
              <td style={{ textAlign: "right", color: "var(--fg-4)" }}>→</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ====== ITEMS (Catalogo) ======
function Items() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo</h1>
          <div className="page-subtitle">8 ítems · 4 categorías · revisá precios cada cierre de mes</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">Actualizar precios</button>
          <button className="btn btn-primary" type="button">+ Nuevo ítem</button>
        </div>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 100 }}>SKU</th>
            <th>Ítem</th>
            <th style={{ width: 130 }}>Categoría</th>
            <th className="num" style={{ width: 100 }}>Usado en</th>
            <th className="num" style={{ width: 160 }}>Precio actual</th>
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {CATALOGO.map(it => (
            <tr key={it.sku}>
              <td><span className="cell-id">{it.sku}</span></td>
              <td className="cell-name">{it.nombre}</td>
              <td className="cell-sub">{it.categoria}</td>
              <td className="num mono">{it.usado}</td>
              <td className="num mono">ARS {ARS(it.precio)}</td>
              <td style={{ textAlign: "right", color: "var(--fg-4)" }}>→</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ====== GASTOS ======
function Gastos() {
  const total = GASTOS.reduce((a, g) => a + g.monto, 0);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gastos</h1>
          <div className="page-subtitle">Mayo 2026 · 6 gastos registrados</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">Escanear factura</button>
          <button className="btn btn-primary" type="button">+ Nuevo gasto</button>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom: 28 }}>
        <div className="kpi">
          <div className="kpi-label gasto"><span className="dot"></span>Gastado este mes</div>
          <div className="kpi-value"><span className="currency">ARS</span>{ARS(total)}</div>
          <div className="kpi-delta down">↓ −8,1% · vs abril</div>
        </div>
        <div className="kpi">
          <div className="kpi-label neutral"><span className="dot"></span>Promedio mensual (6m)</div>
          <div className="kpi-value mono">ARS {ARS(833_700)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label neutral"><span className="dot"></span>Mayor categoría</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>Operaciones</div>
          <div className="kpi-delta">{ARS(476_300)} · 42,8%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label neutral"><span className="dot"></span>Margen del mes</div>
          <div className="kpi-value mono" style={{ color: "var(--mint)" }}>84,7%</div>
        </div>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>Descripción</th>
            <th style={{ width: 140 }}>Categoría</th>
            <th style={{ width: 110 }}>Fecha</th>
            <th className="num" style={{ width: 160 }}>Monto</th>
            <th style={{ width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {GASTOS.map((g, i) => (
            <tr key={i}>
              <td className="cell-name">{g.d}</td>
              <td><span className="tag muted"><span className="dot"></span>{g.cat}</span></td>
              <td className="cell-sub">{g.fecha} 2026</td>
              <td className="num mono" style={{ color: "var(--orange)" }}>−ARS {ARS(g.monto)}</td>
              <td style={{ textAlign: "right", color: "var(--fg-4)" }}>→</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ====== AJUSTES ======
function Ajustes() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ajustes</h1>
          <div className="page-subtitle">Datos de tu empresa, preferencias y conexiones</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 36 }}>
        <div className="nav-section" style={{ position: "sticky", top: 80 }}>
          {["Empresa", "Facturación", "Cuenta", "Notificaciones", "Integraciones", "Plantillas"].map((s, i) => (
            <button key={s} className="nav-item" aria-current={i === 0} type="button" style={{ position: "relative" }}>
              <span>{s}</span>
            </button>
          ))}
        </div>

        <div>
          <div className="section-head" style={{ marginTop: 0 }}>
            <div className="section-title">Datos de empresa</div>
            <span className="section-meta">aparecen en cada PDF</span>
          </div>
          <hr className="rule" style={{ marginBottom: 22 }} />

          <div className="form-grid">
            <div className="field">
              <label>Razón social</label>
              <input defaultValue="Promat" />
            </div>
            <div className="field">
              <label>CUIT</label>
              <input className="mono" defaultValue="20-32849181-4" />
            </div>
            <div className="field">
              <label>Condición frente al IVA</label>
              <select defaultValue="Monotributo B">
                <option>Monotributo A</option>
                <option>Monotributo B</option>
                <option>Monotributo C</option>
                <option>Responsable inscripto</option>
              </select>
            </div>
            <div className="field">
              <label>Email de contacto</label>
              <input defaultValue="nico@promat.com.ar" />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Domicilio fiscal</label>
              <input defaultValue="Av. Corrientes 1248, piso 3 · CABA" />
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <div className="section-title">Preferencias</div>
            </div>
            <hr className="rule" style={{ marginBottom: 22 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { l: "Idioma del PDF", v: "Español (Argentina)" },
                { l: "Moneda por defecto", v: "ARS · Peso argentino" },
                { l: "Vencimiento por defecto", v: "30 días corridos" },
                { l: "Numeración", v: "COT-####" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 13 }}>{r.l}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="mono" style={{ fontSize: 12.5, color: "var(--fg-2)" }}>{r.v}</span>
                    <button className="btn-ghost btn-sm" type="button" style={{ color: "var(--fg-3)" }}>Editar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Nueva, Clientes, Items, Gastos, Ajustes });
