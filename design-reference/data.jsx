// data.jsx — mock data realista argentino para Cotizapp
// Numbers in ARS. Dates in 2026.

const COTIZACIONES = [
  {
    id: "COT-0241",
    cliente: { name: "Estudio Ferrari Arquitectura", initials: "EF", contacto: "Lucas Ferrari", email: "lucas@ferrari-arq.com.ar" },
    fechaEmision: "27 May 2026",
    vence: "26 Jun 2026",
    monto: 1_245_000,
    estado: "enviada",
    nota: "Reenviada por WhatsApp el 27/05.",
    items: [
      { d: "Diseño de identidad — manual de marca", q: 1, p: 680_000 },
      { d: "Sesión fotográfica — espacios de oficina", q: 1, p: 420_000 },
      { d: "Retoque digital y entrega", q: 4, p: 36_250 },
    ],
  },
  {
    id: "COT-0240",
    cliente: { name: "Distribuidora La Pampa SRL", initials: "DL", contacto: "Mariana Sosa", email: "compras@lapampa.com.ar" },
    fechaEmision: "26 May 2026",
    vence: "10 Jun 2026",
    monto: 3_870_500,
    estado: "aceptada",
    nota: "Aceptada el 27/05. Esperando seña.",
    items: [
      { d: "Sistema de gestión a medida — fase 1", q: 1, p: 2_400_000 },
      { d: "Migración de datos legacy", q: 1, p: 870_500 },
      { d: "Capacitación equipo (4 sesiones)", q: 4, p: 150_000 },
    ],
  },
  {
    id: "COT-0239",
    cliente: { name: "Café Tortoni Catering", initials: "CT", contacto: "Roberto Méndez", email: "roberto@tortoni-catering.ar" },
    fechaEmision: "24 May 2026",
    vence: "08 Jun 2026",
    monto: 580_000,
    estado: "borrador",
    nota: "Falta cargar dos ítems del catálogo.",
    items: [
      { d: "Servicio coffee break — 50 personas", q: 1, p: 380_000 },
      { d: "Set up + retiro", q: 1, p: 200_000 },
    ],
  },
  {
    id: "COT-0238",
    cliente: { name: "Talleres Mendoza", initials: "TM", contacto: "Hernán Acuña", email: "admin@talleresmendoza.com" },
    fechaEmision: "22 May 2026",
    vence: "21 Jun 2026",
    monto: 2_150_000,
    estado: "enviada",
    nota: "Vista pública abierta hace 2 días.",
    items: [
      { d: "Mantenimiento mensual sitio web", q: 6, p: 180_000 },
      { d: "Optimización SEO técnica", q: 1, p: 1_070_000 },
    ],
  },
  {
    id: "COT-0237",
    cliente: { name: "María José Pérez", initials: "MP", contacto: "María José Pérez", email: "mjperez.consultora@gmail.com" },
    fechaEmision: "20 May 2026",
    vence: "04 Jun 2026",
    monto: 425_000,
    estado: "rechazada",
    nota: "Cliente pidió cotizar a menor scope.",
    items: [
      { d: "Auditoría contable trimestral", q: 1, p: 425_000 },
    ],
  },
  {
    id: "COT-0236",
    cliente: { name: "Constructora del Sur", initials: "CS", contacto: "Andrés Quiroga", email: "andres@delsur.ar" },
    fechaEmision: "19 May 2026",
    vence: "18 Jun 2026",
    monto: 6_420_000,
    estado: "aceptada",
    nota: "Pagaron 30% de seña.",
    items: [
      { d: "Pliego técnico — proyecto galpón industrial", q: 1, p: 4_200_000 },
      { d: "Dirección de obra (6 meses)", q: 6, p: 370_000 },
    ],
  },
  {
    id: "COT-0235",
    cliente: { name: "Estudio Ferrari Arquitectura", initials: "EF", contacto: "Lucas Ferrari", email: "lucas@ferrari-arq.com.ar" },
    fechaEmision: "15 May 2026",
    vence: "30 May 2026",
    monto: 320_000,
    estado: "aceptada",
    nota: "Adicional sobre cotización original.",
    items: [
      { d: "Iteración extra render 3D", q: 2, p: 160_000 },
    ],
  },
  {
    id: "COT-0234",
    cliente: { name: "Panadería Sarmiento", initials: "PS", contacto: "Ezequiel Báez", email: "ezeq@sarmiento.com.ar" },
    fechaEmision: "12 May 2026",
    vence: "27 May 2026",
    monto: 185_000,
    estado: "borrador",
    nota: "Pendiente de revisión de precios.",
    items: [
      { d: "Diseño packaging — línea premium", q: 1, p: 185_000 },
    ],
  },
];

const CLIENTES = [
  { name: "Estudio Ferrari Arquitectura", initials: "EF", contacto: "Lucas Ferrari", email: "lucas@ferrari-arq.com.ar", tel: "+54 9 11 4823-1190", cotizados: 4, facturado: 1_645_000, ultima: "27 May" },
  { name: "Constructora del Sur", initials: "CS", contacto: "Andrés Quiroga", email: "andres@delsur.ar", tel: "+54 9 261 519-8841", cotizados: 6, facturado: 6_420_000, ultima: "19 May" },
  { name: "Distribuidora La Pampa SRL", initials: "DL", contacto: "Mariana Sosa", email: "compras@lapampa.com.ar", tel: "+54 9 2954 41-2204", cotizados: 3, facturado: 3_870_500, ultima: "26 May" },
  { name: "Talleres Mendoza", initials: "TM", contacto: "Hernán Acuña", email: "admin@talleresmendoza.com", tel: "+54 9 261 622-0918", cotizados: 5, facturado: 980_000, ultima: "22 May" },
  { name: "Café Tortoni Catering", initials: "CT", contacto: "Roberto Méndez", email: "roberto@tortoni-catering.ar", tel: "+54 9 11 5278-3340", cotizados: 2, facturado: 380_000, ultima: "24 May" },
  { name: "María José Pérez", initials: "MP", contacto: "María José Pérez", email: "mjperez.consultora@gmail.com", tel: "+54 9 351 415-0072", cotizados: 1, facturado: 0, ultima: "20 May" },
  { name: "Panadería Sarmiento", initials: "PS", contacto: "Ezequiel Báez", email: "ezeq@sarmiento.com.ar", tel: "+54 9 11 6188-2210", cotizados: 1, facturado: 0, ultima: "12 May" },
];

const CATALOGO = [
  { sku: "SRV-001", nombre: "Diseño de identidad — manual de marca", categoria: "Diseño", precio: 680_000, usado: 18 },
  { sku: "SRV-002", nombre: "Sistema de gestión a medida — fase 1", categoria: "Software", precio: 2_400_000, usado: 4 },
  { sku: "SRV-003", nombre: "Mantenimiento mensual sitio web", categoria: "Software", precio: 180_000, usado: 32 },
  { sku: "SRV-004", nombre: "Sesión fotográfica — producto/espacio", categoria: "Producción", precio: 420_000, usado: 11 },
  { sku: "SRV-005", nombre: "Auditoría contable trimestral", categoria: "Consultoría", precio: 425_000, usado: 6 },
  { sku: "SRV-006", nombre: "Capacitación equipo — por sesión", categoria: "Consultoría", precio: 150_000, usado: 14 },
  { sku: "SRV-007", nombre: "Optimización SEO técnica", categoria: "Software", precio: 1_070_000, usado: 3 },
  { sku: "SRV-008", nombre: "Diseño packaging — línea premium", categoria: "Diseño", precio: 185_000, usado: 9 },
];

const GASTOS = [
  { d: "Adobe Creative Cloud — equipo", cat: "Software", monto: 89_400, fecha: "26 May" },
  { d: "Hosting + dominios (Q2)", cat: "Software", monto: 142_000, fecha: "24 May" },
  { d: "Alquiler estudio mayo", cat: "Operaciones", monto: 380_000, fecha: "05 May" },
  { d: "Honorarios contadora — abril", cat: "Servicios", monto: 220_000, fecha: "03 May" },
  { d: "Insumos imprenta — Distribuidora La Pampa", cat: "Producción", monto: 184_500, fecha: "12 May" },
  { d: "Combustible + viáticos", cat: "Operaciones", monto: 96_300, fecha: "18 May" },
];

// 6-meses para chart: [mes, cotizado, gasto]
const SERIE_6M = [
  { m: "Dic", cot: 2_140_000, gas: 580_000 },
  { m: "Ene", cot: 3_280_000, gas: 720_000 },
  { m: "Feb", cot: 2_920_000, gas: 690_000 },
  { m: "Mar", cot: 4_180_000, gas: 880_000 },
  { m: "Abr", cot: 5_640_000, gas: 1_020_000 },
  { m: "May", cot: 7_295_500, gas: 1_112_200 },
];

// spark micro-series
const SPARK_COBRADO  = [12,18,15,22,26,28,32,30,38,42,44,52,58,62];
const SPARK_PENDIENTE= [42,38,40,36,42,48,46,52,56,54,58,60,55,52];
const SPARK_GASTO    = [8,10,9,12,14,11,15,17,15,18,20,19,22,21];
const SPARK_NETA     = [4,6,5,8,10,12,14,12,18,22,24,30,32,38];

const ACTIVITY = [
  { time: "09:42", text: <><strong>Mariana Sosa</strong> aceptó <strong>COT-0240</strong>. Esperando seña.</>, amount: "+3.870.500", tone: "mint" },
  { time: "08:18", text: <>Cobraste <strong>COT-0236</strong> — Constructora del Sur (seña 30%).</>, amount: "+1.926.000", tone: "mint" },
  { time: "ayer 19:30", text: <>Vista pública abierta — <strong>Talleres Mendoza</strong> revisó la cotización 3 veces.</>, amount: "", tone: "muted" },
  { time: "ayer 16:04", text: <>Reenviaste <strong>COT-0241</strong> por WhatsApp a Lucas Ferrari.</>, amount: "", tone: "muted" },
  { time: "ayer 11:21", text: <>Registraste gasto <strong>Alquiler estudio mayo</strong>.</>, amount: "−380.000", tone: "orange" },
  { time: "lun 17:45", text: <><strong>María José Pérez</strong> rechazó <strong>COT-0237</strong>. Pidió cotizar a menor scope.</>, amount: "", tone: "muted" },
];

const COUNTS = {
  todas: COTIZACIONES.length,
  borrador: COTIZACIONES.filter(c => c.estado === "borrador").length,
  enviada: COTIZACIONES.filter(c => c.estado === "enviada").length,
  aceptada: COTIZACIONES.filter(c => c.estado === "aceptada").length,
  rechazada: COTIZACIONES.filter(c => c.estado === "rechazada").length,
};

const ARS = (n) => {
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (neg ? "−" : "") + s;
};
const ARSc = (n) => {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

Object.assign(window, {
  COTIZACIONES, CLIENTES, CATALOGO, GASTOS, SERIE_6M,
  SPARK_COBRADO, SPARK_PENDIENTE, SPARK_GASTO, SPARK_NETA,
  ACTIVITY, COUNTS, ARS, ARSc,
});
