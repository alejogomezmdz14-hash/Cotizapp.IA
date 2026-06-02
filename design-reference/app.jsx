// app.jsx — entrypoint + router + tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#3DD68C",
  "density": "regular",
  "dialect": "vos",
  "serif_moments": true,
  "show_quote": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("dashboard");
  const [detailId, setDetailId] = React.useState("COT-0240");

  React.useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
  }, [t.accent]);

  React.useEffect(() => {
    document.body.dataset.density = t.density;
  }, [t.density]);

  const openRoute = (r, id) => {
    if (id) setDetailId(id);
    setRoute(r);
    window.scrollTo(0, 0);
  };

  let screen = null;
  switch (route) {
    case "dashboard":    screen = <Dashboard onOpen={openRoute} />; break;
    case "cotizaciones": screen = <Cotizaciones onOpen={openRoute} />; break;
    case "nueva":        screen = <Nueva onOpen={openRoute} />; break;
    case "detalle":      screen = <CotizacionDetalle id={detailId} onOpen={openRoute} />; break;
    case "clientes":     screen = <Clientes onOpen={openRoute} />; break;
    case "items":        screen = <Items />; break;
    case "gastos":       screen = <Gastos />; break;
    case "ajustes":      screen = <Ajustes />; break;
    default:             screen = <Dashboard onOpen={openRoute} />;
  }

  return (
    <div className="tweaks-host app" data-density={t.density}>
      <Sidebar route={route} onRoute={openRoute} />
      <div className="main">
        <Topbar route={route} />
        {screen}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Marca" />
        <TweakColor
          label="Acento"
          value={t.accent}
          options={["#3DD68C", "#7C5BFF", "#F5C518", "#E5572C", "#5AC8FA"]}
          onChange={(v) => setTweak("accent", v)}
        />

        <TweakSection label="Densidad" />
        <TweakRadio
          label="Densidad"
          value={t.density}
          options={["compact", "regular"]}
          onChange={(v) => setTweak("density", v)}
        />

        <TweakSection label="Personalidad" />
        <TweakRadio
          label="Dialecto"
          value={t.dialect}
          options={["vos", "tú", "usted"]}
          onChange={(v) => setTweak("dialect", v)}
        />
        <TweakToggle
          label="Momentos serif"
          value={t.serif_moments}
          onChange={(v) => setTweak("serif_moments", v)}
        />
        <TweakToggle
          label="Mostrar cita editorial"
          value={t.show_quote}
          onChange={(v) => setTweak("show_quote", v)}
        />

        <TweakSection label="Navegación" />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            ["dashboard", "Resumen"],
            ["cotizaciones", "Cotizaciones"],
            ["detalle", "Detalle de cotización"],
            ["nueva", "Nueva cotización"],
            ["clientes", "Clientes"],
            ["items", "Catálogo"],
            ["gastos", "Gastos"],
            ["ajustes", "Ajustes"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => openRoute(id)}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderRadius: 5,
                background: route === id ? "rgba(255,255,255,0.08)" : "transparent",
                color: route === id ? "#fff" : "#9aa",
                fontSize: 12,
                cursor: "pointer",
                border: 0,
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
