// app-print.jsx — render every screen stacked for PDF export

function PrintApp() {
  const screens = [
    { id: "dashboard",    Comp: Dashboard,    label: "Resumen" },
    { id: "cotizaciones", Comp: Cotizaciones, label: "Cotizaciones" },
    { id: "detalle",      Comp: () => <CotizacionDetalle id="COT-0240" onOpen={() => {}} />, label: "Detalle de cotización" },
    { id: "nueva",        Comp: Nueva,        label: "Nueva cotización" },
    { id: "clientes",     Comp: Clientes,     label: "Clientes" },
    { id: "items",        Comp: Items,        label: "Catálogo" },
    { id: "gastos",       Comp: Gastos,       label: "Gastos" },
    { id: "ajustes",      Comp: Ajustes,      label: "Ajustes" },
  ];

  React.useEffect(() => {
    document.documentElement.style.setProperty("--accent", "#3DD68C");
    document.body.dataset.density = "regular";
  }, []);

  return (
    <>
      {screens.map((s, idx) => {
        const Comp = s.Comp;
        return (
          <div key={s.id} className="print-page" data-screen={s.label}>
            <div className="app">
              <Sidebar route={s.id} onRoute={() => {}} />
              <div className="main">
                <Topbar route={s.id} />
                <Comp onOpen={() => {}} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<PrintApp />);

// Auto-print once everything's painted
(function autoPrint() {
  const fire = () => setTimeout(() => window.print(), 500);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      // wait a tick for React commit + a bit for sparklines/charts to layout
      setTimeout(fire, 600);
    });
  } else {
    window.addEventListener("load", () => setTimeout(fire, 800));
  }
})();
