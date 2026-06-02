// components.jsx — shared UI primitives
// Sidebar, Topbar, Sparkline, BarChart, etc.

const { useState, useEffect, useMemo, useRef } = React;

// ====== Sparkline (svg) ======
function Sparkline({ data, color = "currentColor", height = 28, fill = false, strokeWidth = 1.5 }) {
  const w = 100, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 3 - ((v - min) / range) * (h - 6);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const last = pts.split(" ").slice(-1)[0].split(",");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark" style={{ color }}>
      {fill && (
        <polygon
          points={`0,${h} ${pts} ${w},${h}`}
          fill={color}
          opacity="0.12"
        />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="1.8" fill={color} />
    </svg>
  );
}

// ====== Stacked bar chart ======
function BarChart({ data, height = 220 }) {
  const max = Math.max(...data.map(d => Math.max(d.cot, d.gas))) * 1.15;
  const yTicks = 4;
  const w = 600, h = height;
  const padL = 44, padR = 8, padT = 12, padB = 26;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const bw = innerW / data.length;
  const barW = 14;
  const gap = 4;

  const fmt = (v) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1_000) return Math.round(v / 1_000) + "k";
    return v;
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      {/* y-grid */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = (max / yTicks) * (yTicks - i);
        const y = padT + (innerH / yTicks) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} fontSize="10" fill="rgba(255,255,255,0.4)" textAnchor="end" fontFamily="JetBrains Mono">
              {fmt(v)}
            </text>
          </g>
        );
      })}
      {/* bars */}
      {data.map((d, i) => {
        const cx = padL + bw * i + bw / 2;
        const hCot = (d.cot / max) * innerH;
        const hGas = (d.gas / max) * innerH;
        return (
          <g key={i}>
            <rect x={cx - barW - gap / 2} y={padT + innerH - hCot} width={barW} height={hCot} fill="var(--mint)" rx="1" />
            <rect x={cx + gap / 2} y={padT + innerH - hGas} width={barW} height={hGas} fill="var(--orange)" rx="1" opacity="0.85" />
            <text x={cx} y={h - 8} fontSize="10.5" fill="rgba(255,255,255,0.5)" textAnchor="middle" fontFamily="JetBrains Mono">
              {d.m}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ====== Sidebar ======
function Sidebar({ route, onRoute }) {
  const nav = [
    { section: "Operación", items: [
      { id: "dashboard",    label: "Resumen",        badge: "" },
      { id: "cotizaciones", label: "Cotizaciones",   badge: COUNTS.todas },
      { id: "nueva",        label: "Nueva",          badge: "N" },
      { id: "gastos",       label: "Gastos",         badge: "" },
    ]},
    { section: "Catálogo", items: [
      { id: "clientes",     label: "Clientes",       badge: CLIENTES.length },
      { id: "items",        label: "Ítems",          badge: CATALOGO.length },
    ]},
    { section: "Cuenta", items: [
      { id: "ajustes",      label: "Ajustes",        badge: "" },
    ]},
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">c</span>
        <span className="brand-name">Cotizapp</span>
      </div>

      <button className="org-switch" type="button">
        <span className="org-avatar">P</span>
        <span className="org-info">
          <div className="org-name">Promat</div>
          <div className="org-meta">monotributo · cat. B</div>
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="org-caret"><path d="M2 4 L5 7 L8 4" className="icon-stroke" /></svg>
      </button>

      {nav.map((s) => (
        <div className="nav-section" key={s.section}>
          <div className="nav-section-label">{s.section}</div>
          {s.items.map((it) => (
            <button
              key={it.id}
              type="button"
              className="nav-item"
              aria-current={route === it.id}
              onClick={() => onRoute(it.id)}
              style={{ position: "relative" }}
            >
              <span>{it.label}</span>
              {it.badge !== "" && <span className="badge">{it.badge}</span>}
            </button>
          ))}
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-av">NH</div>
          <div className="user-info">
            <div className="user-name">Nicolás Herrera</div>
            <div className="user-email">nico@promat.com.ar</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ====== Topbar ======
function Topbar({ route, title }) {
  const breadcrumbMap = {
    dashboard:   ["Promat", "Resumen"],
    cotizaciones:["Promat", "Cotizaciones"],
    nueva:       ["Promat", "Cotizaciones", "Nueva"],
    detalle:     ["Promat", "Cotizaciones", "COT-0240"],
    clientes:    ["Promat", "Clientes"],
    items:       ["Promat", "Catálogo"],
    gastos:      ["Promat", "Gastos"],
    ajustes:     ["Promat", "Ajustes"],
  };
  const crumbs = breadcrumbMap[route] || breadcrumbMap.dashboard;
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? "here" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="search">
        <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" className="icon-stroke" /><path d="M9.5 9.5 L12 12" className="icon-stroke" /></svg>
        <input placeholder="Buscar cliente, cotización, ítem…" />
        <span className="kbd">⌘K</span>
      </div>
      <div className="topbar-actions">
        <button className="btn btn-ghost btn-sm" type="button">Ayuda</button>
        <span style={{ width: 1, height: 18, background: "var(--line)" }}></span>
        <button className="btn btn-sm" type="button">Hoy · 27 May</button>
      </div>
    </div>
  );
}

// ====== Tag ======
function Tag({ kind, children }) {
  const map = {
    borrador: "muted",
    enviada: "amber",
    aceptada: "mint",
    rechazada: "red",
    vencida: "orange",
  };
  const cls = "tag " + (map[kind] || kind || "");
  const labels = {
    borrador: "Borrador",
    enviada: "Enviada",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    vencida: "Vencida",
  };
  return (
    <span className={cls}>
      <span className="dot"></span>
      {children || labels[kind] || kind}
    </span>
  );
}

Object.assign(window, { Sparkline, BarChart, Sidebar, Topbar, Tag });
