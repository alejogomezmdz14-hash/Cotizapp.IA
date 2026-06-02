// dashboard.jsx — Vista de resumen
const { Fragment } = React;

function KpiCell({ tone = "mint", label, currency, value, cents, delta, deltaDir, deltaNote, spark }) {
  return (
    <div className="kpi">
      <div className={"kpi-label " + tone}>
        <span className="dot"></span>
        {label}
      </div>
      <div className="kpi-value">
        {currency && <span className="currency">ARS</span>}
        {value}
        {cents && <span className="cents">,{cents}</span>}
      </div>
      <div className="kpi-delta" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className={"kpi-delta " + (deltaDir || "")}>
          {deltaDir === "up" ? "↑" : deltaDir === "down" ? "↓" : "·"} {delta}
          {deltaNote && <><span className="sep">·</span><span style={{ color: "var(--fg-4)" }}>{deltaNote}</span></>}
        </span>
        {spark && <span style={{ width: 88, color: "var(--mint)" }}>{spark}</span>}
      </div>
    </div>
  );
}

function Dashboard({ onOpen }) {
  const aceptadas = COTIZACIONES.filter(c => c.estado === "aceptada");
  const cobradoMes = aceptadas.reduce((a, c) => a + c.monto, 0);
  const pendiente = COTIZACIONES.filter(c => c.estado === "enviada").reduce((a, c) => a + c.monto, 0);
  const gastosMes = GASTOS.reduce((a, g) => a + g.monto, 0);
  const neta = cobradoMes - gastosMes;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="kicker" style={{ marginBottom: 6 }}>
            <span>Mayo 2026</span>
            <span style={{ margin: "0 8px", color: "var(--fg-4)" }}>·</span>
            <span>27 días corridos</span>
          </div>
          <h1 className="page-title">Buenas, Nico.</h1>
          <div className="page-subtitle">
            Esta semana cerraste <span style={{ color: "var(--fg)" }}>2 cotizaciones</span>.
            Hay <span style={{ color: "var(--amber)" }}>2 enviadas sin respuesta</span> hace más de 48&nbsp;h.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">Importar gastos</button>
          <button className="btn btn-primary btn-lg" type="button" onClick={() => onOpen("nueva")}>
            Nueva cotización
            <span className="kbd" style={{ background: "rgba(6,20,13,0.15)", borderColor: "rgba(6,20,13,0.25)", color: "#06140d" }}>N</span>
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row">
        <KpiCell
          tone="mint"
          label="Cobrado este mes"
          currency
          value="7.295.500"
          cents="00"
          deltaDir="up"
          delta="+29,3%"
          deltaNote="vs abril"
          spark={<Sparkline data={SPARK_COBRADO} color="var(--mint)" fill />}
        />
        <KpiCell
          tone="pendiente"
          label="Por cobrar"
          value="4.115.000"
          deltaNote="2 cotizaciones · vence en 14 días"
          spark={<Sparkline data={SPARK_PENDIENTE} color="var(--amber)" />}
        />
        <KpiCell
          tone="gasto"
          label="Gastos"
          value="1.112.200"
          deltaDir="down"
          delta="−8,1%"
          deltaNote="vs abril"
          spark={<Sparkline data={SPARK_GASTO} color="var(--orange)" />}
        />
        <KpiCell
          tone="neutral"
          label="Ganancia neta"
          value="6.183.300"
          deltaNote="margen 84,7%"
          spark={<Sparkline data={SPARK_NETA} color="var(--fg-2)" />}
        />
      </div>

      {/* Split: chart + activity */}
      <div className="dash-split">
        <div>
          <div className="section-head" style={{ marginTop: 0 }}>
            <div>
              <div className="kicker">Últimos 6 meses</div>
              <div className="section-title" style={{ marginTop: 4 }}>Cotizado vs. gastos</div>
            </div>
            <div className="seg">
              <button aria-pressed="false" type="button">3M</button>
              <button aria-pressed="true" type="button">6M</button>
              <button aria-pressed="false" type="button">12M</button>
            </div>
          </div>
          <BarChart data={SERIE_6M} height={240} />
          <div className="legend" style={{ marginTop: 14 }}>
            <span><span className="swatch" style={{ background: "var(--mint)" }}></span>Cotizado aceptado</span>
            <span><span className="swatch" style={{ background: "var(--orange)" }}></span>Gastos</span>
          </div>

          {/* Pendientes table */}
          <div className="section">
            <div className="section-head">
              <div className="section-title">Esperando respuesta</div>
              <a className="section-link" onClick={() => onOpen("cotizaciones")}>Ver cotizaciones →</a>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Cliente</th>
                  <th>Enviada</th>
                  <th>Vence</th>
                  <th className="num">Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {COTIZACIONES.filter(c => c.estado === "enviada").map(c => (
                  <tr key={c.id} onClick={() => onOpen("detalle")}>
                    <td><span className="cell-id">{c.id}</span></td>
                    <td>
                      <div className="av-row">
                        <span className="av">{c.cliente.initials}</span>
                        <span className="cell-name">{c.cliente.name}</span>
                      </div>
                    </td>
                    <td className="cell-sub">{c.fechaEmision}</td>
                    <td className="cell-sub">{c.vence}</td>
                    <td className="num mono">{ARS(c.monto)}</td>
                    <td style={{ width: 32, textAlign: "right" }}>
                      <span style={{ color: "var(--fg-4)" }}>→</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {/* Activity */}
          <div className="section-head" style={{ marginTop: 0 }}>
            <div>
              <div className="kicker">Hoy · 27 May</div>
              <div className="section-title" style={{ marginTop: 4 }}>Actividad reciente</div>
            </div>
          </div>
          <div className="activity">
            {ACTIVITY.map((a, i) => (
              <div className="activity-item" key={i}>
                <div className="activity-time">{a.time}</div>
                <div className="activity-text">{a.text}</div>
                <div className={"activity-amount " + (a.tone === "mint" ? "" : a.tone === "orange" ? "" : "")} style={{ color: a.tone === "mint" ? "var(--mint)" : a.tone === "orange" ? "var(--orange)" : "var(--fg-3)" }}>
                  {a.amount}
                </div>
              </div>
            ))}
          </div>

          {/* Top clientes */}
          <div className="section">
            <div className="section-head">
              <div className="section-title">Clientes del mes</div>
              <a className="section-link" onClick={() => onOpen("clientes")}>Ver todos →</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {CLIENTES.slice(0, 4).sort((a,b) => b.facturado - a.facturado).map((c, i) => {
                const pct = (c.facturado / 7_295_500) * 100;
                return (
                  <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div className="av-row">
                        <span className="av">{c.initials}</span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                      </div>
                      <span className="mono" style={{ fontSize: 12.5 }}>{ARS(c.facturado)}</span>
                    </div>
                    <div style={{ height: 2, background: "var(--line)", borderRadius: 1, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: "var(--mint)" }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editorial quote */}
          <div className="section" style={{ marginTop: 44 }}>
            <p className="quote">
              "El mejor presupuesto es el que cobrás antes de fin de mes."
            </p>
            <div className="kicker" style={{ marginTop: 12 }}>— refrán de monotributista, atribuido</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
