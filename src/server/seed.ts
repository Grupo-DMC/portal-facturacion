/**
 * Datos FICTICIOS de DMC Facturación (basados en la maqueta v2). Generación determinista:
 * misma semilla -> mismos datos. Sustituir por el repositorio mssql cuando exista la BD.
 */
import { addDays, calcVenc as calcV, diffDays, D, nextBiz as nb, rutFmt } from "@/lib/domain";
import type { AppUser, Client, Config, Gestion, Invoice, OcSinFactura, Payment, Plan, Ref } from "@/lib/types";

export interface SeedData {
  invoices: Invoice[];
  clients: Client[];
  plans: Plan[];
  ocs: OcSinFactura[];
  users: AppUser[];
  config: Config;
  ncNext: number;
  y2025: number[];
}

const HOLIDAYS = [
  ["2026-01-01", "Año Nuevo"], ["2026-04-03", "Viernes Santo"], ["2026-04-04", "Sábado Santo"], ["2026-05-01", "Día del Trabajo"],
  ["2026-05-21", "Glorias Navales"], ["2026-06-21", "Día de los Pueblos Indígenas"], ["2026-06-29", "San Pedro y San Pablo"],
  ["2026-07-16", "Virgen del Carmen"], ["2026-08-15", "Asunción de la Virgen"], ["2026-09-18", "Independencia Nacional"],
  ["2026-09-19", "Glorias del Ejército"], ["2026-10-12", "Encuentro de Dos Mundos"], ["2026-10-31", "Día de las Iglesias Evangélicas"],
  ["2026-11-01", "Día de Todos los Santos"], ["2026-12-08", "Inmaculada Concepción"], ["2026-12-25", "Navidad"],
].map(([f, n]) => ({ f, n }));

const EMAIL_TPL =
  "Estimado/a {contacto}:\n\nJunto con saludar, adjuntamos el estado de cuenta de {cliente} al {fecha}, con un saldo pendiente de {monto} correspondiente a las facturas {folios}.\n\nAgradeceremos confirmar la fecha de pago o informarnos si existe alguna observación.\n\nSaludos cordiales,\n{usuario}\nFacturación · Comercializadora DMC SpA";
const ENVIO_TPL =
  "Estimado/a {contacto}:\n\nJunto con saludar, adjuntamos la factura electrónica N° {folio} de Comercializadora DMC SpA por un total de {total}, asociada a {referencia}.\n\nVencimiento: {vencimiento} ({condicion}).\n\nQuedamos atentos a cualquier consulta.\n\nSaludos cordiales,\n{usuario}\nFacturación · Comercializadora DMC SpA";

type CL = [string, string, number, string, string, string[], number, string, string, string, "core" | "local", number];
const CLIENTS: CL[] = [
  ["walmart", "Walmart Chile S.A.", 76042014, "Supermercados y grandes tiendas", "Av. del Valle 725, Huechuraba", ["Líder 71 Vespucio", "Líder 88 Los Dominicos", "Líder 674 Pedro Fontova", "Líder 92 La Florida", "Express 133 Ñuñoa", "Ekono 412 Maipú", "SBA 579 Lampa"], 30, "Carolina Rojas", "pagos.proveedores@walmart.example", "+56 2 2200 5000", "core", 30],
  ["smu", "SMU S.A.", 76012676, "Supermercados", "Cerro El Plomo 5680, Las Condes", ["Unimarc 215 Providencia", "Unimarc 88 Rancagua", "Alvi 30 Quilicura"], 45, "Felipe Araya", "cuentasporpagar@smu.example", "+56 2 2818 8000", "core", 10],
  ["ahumada", "Farmacias Ahumada S.A.", 93767000, "Farmacias", "Av. Apoquindo 3000, Las Condes", ["Ahumada 1021 Huérfanos", "Ahumada 410 Concepción"], 60, "Daniela Fuentes", "tesoreria@ahumada.example", "+56 2 2387 3000", "core", 7],
  ["nike", "Nike de Chile Ltda.", 77381220, "Retail deportivo", "Av. Kennedy 5413, Las Condes", ["Nike Easton", "Nike Parque Arauco", "Nike Costanera"], 30, "Javiera Molina", "ap.chile@nike.example", "+56 2 2412 6600", "core", 6],
  ["puma", "Puma Chile S.A.", 96912340, "Retail deportivo", "Av. Vitacura 2939, Las Condes", ["Puma Mall Plaza Vespucio", "Puma Outlet Buenaventura"], 30, "Sebastián Lagos", "facturas@puma.example", "+56 2 2370 4400", "core", 5],
  ["adidas", "Adidas Chile Ltda.", 96671750, "Retail deportivo", "Av. Presidente Riesco 5335, Las Condes", ["Adidas Alto Las Condes", "Adidas Arauco Maipú"], 30, "Constanza Pino", "cxp.chile@adidas.example", "+56 2 2715 2000", "core", 5],
  ["maui", "Comercial Maui S.A.", 96543210, "Vestuario", "Av. Las Condes 11000, Vitacura", ["Maui Costanera", "Maui Viña"], 30, "Ignacio Bravo", "pagos@maui.example", "+56 2 2954 3100", "core", 4],
  ["lippi", "Lippi Outdoor S.A.", 96839720, "Vestuario outdoor", "Av. Américo Vespucio 1737, Huechuraba", ["Lippi Buenaventura", "Lippi Costanera"], 30, "Francisca León", "finanzas@lippi.example", "+56 2 2898 0400", "core", 4],
  ["pillin", "Pillín S.A.", 89637400, "Vestuario infantil", "Av. Departamental 1580, San Joaquín", ["Pillín Florida Center", "Pillín Mall Arauco Maipú"], 60, "Rosa Castillo", "tesoreria@pillin.example", "+56 2 2550 2900", "core", 4],
  ["futbol", "100% Fútbol SpA", 76598120, "Retail deportivo", "Av. Providencia 2124, Providencia", ["100% Fútbol Plaza Egaña"], 30, "Matías Vidal", "pagos@100futbol.example", "+56 2 2231 7700", "core", 3],
  ["imperial", "Imperial S.A.", 96687030, "Materiales de construcción", "Av. Santa Rosa 7876, La Granja", ["Imperial Santa Rosa", "Imperial Vicuña Mackenna"], 30, "Héctor Navarro", "proveedores@imperial.example", "+56 2 2399 6000", "core", 5],
  ["cannon", "Cannon Home S.A.", 78125480, "Hogar", "Av. Los Libertadores 16500, Colina", ["Cannon Plaza Sur", "Cannon Plaza Oeste"], 30, "Valentina Ortiz", "cxp@cannonhome.example", "+56 2 2444 8800", "core", 4],
  ["central", "Supermercados Central Ltda.", 77543120, "Supermercados", "Av. O’Higgins 1240, Rancagua", [], 30, "Luis Espinoza", "contabilidad@supercentral.example", "+56 72 223 4400", "core", 3],
  ["trebol", "Super Trébol S.A.", 79876540, "Supermercados", "Av. Libertad 1100, Chillán", ["Trébol Chillán", "Trébol Los Ángeles"], 30, "Patricio Vera", "tesoreria@supertrebol.example", "+56 42 221 9900", "core", 3],
  ["gianca", "Constructora Gianca Ltda.", 76935410, "Construcción", "Av. Matta 820, Santiago", [], 0, "Giancarlo Rossi", "grossi@gianca.example", "+56 9 8812 4471", "local", 1],
  ["ark", "ARK S.A.", 76211870, "Importación", "Av. Lo Espejo 450, Cerrillos", [], 0, "Andrea Reyes", "areyes@ark.example", "+56 9 7720 1188", "core", 1],
  ["kmc", "Constructora KMC SpA", 77102540, "Construcción", "Camino Lo Boza 8000, Pudahuel", [], 30, "Karina Muñoz", "kmunoz@kmc.example", "+56 9 6650 3321", "core", 1],
  ["importotal", "Importotal Ltda.", 76450980, "Importación", "Av. Recoleta 2550, Recoleta", [], 30, "Óscar Díaz", "odiaz@importotal.example", "+56 2 2621 0040", "core", 1],
  ["fernapet", "Fernapet SpA", 77890210, "Tiendas de mascotas", "Av. Grecia 3160, Ñuñoa", ["Fernapet Ñuñoa"], 30, "Fernanda Paredes", "fparedes@fernapet.example", "+56 9 9123 4410", "local", 1],
  ["urco", "URCO SpA", 76881230, "Construcción e ingeniería", "Av. Las Industrias 1250, Quilicura", [], 30, "Rodrigo Urrutia", "rurrutia@urco.example", "+56 9 7781 2290", "core", 1],
];

type Extra = [string, string, string, string, boolean, boolean];
const EXTRA: Record<string, Extra[]> = {
  walmart: [["Marcela Soto", "Analista cuentas por pagar", "msoto@walmart.example", "+56 9 6612 3390", false, false], ["Jefe de local Líder 88", "Jefe de tienda", "lider88@walmart.example", "+56 2 2200 5088", false, false], ["Pedro Ibáñez", "Ex encargado de pagos", "pibanez@walmart.example", "+56 9 5511 0021", false, true]],
  ahumada: [["Jorge Lillo", "Contraloría", "jlillo@ahumada.example", "+56 9 8890 1124", false, false]],
  trebol: [["Ana Vera", "Gerencia de administración", "avera@supertrebol.example", "+56 9 7712 4455", false, false]],
  nike: [["Tomás Rivas", "Store manager Easton", "trivas@nike.example", "+56 9 6623 7781", false, false]],
  fernapet: [["Mauricio Paredes", "Dueño", "mparedes@fernapet.example", "+56 9 9876 1234", false, false]],
  urco: [["Claudia Méndez", "Administración de obra", "cmendez@urco.example", "+56 9 6655 2201", false, false]],
  puma: [["Diego Fuenzalida", "Jefe de tienda Plaza Vespucio", "dfuenzalida@puma.example", "+56 9 7001 4432", false, false]],
};

const SERVICES = ["Venta de equipos", "Instalación", "Mantención", "Calibración", "Plan calibración", "Arriendo", "Otro"];
const SVC_W = [28, 22, 25, 8, 6, 7, 4];
const MEDIOS = ["Transferencia", "Transbank", "Efectivo", "Otro"];
const MED_W = [82, 12, 3, 3];
const RECIBIDOS = ["Facturación", "Gustavo (gerencia)", "Cliente directo"];
const REC_W = [70, 18, 12];
const MOTIVOS = ["Rechazo Walmart – N° incorrecto", "Error en datos", "Error en monto", "Otro"];
const CANAL = ["Correo", "WhatsApp", "Otros contactos", "Llamada"] as const;
const USR = "M. J. González";
const pad = (n: number) => String(n).padStart(2, "0");

export function buildSeed(TODAY: string): SeedData {
  let seed = 20261026;
  const R = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)];
  const pickW = <T,>(arr: T[], w: number[]) => { let t = w.reduce((a, b) => a + b, 0) * R(); for (let i = 0; i < arr.length; i++) { t -= w[i]; if (t <= 0) return arr[i]; } return arr[arr.length - 1]; };
  const dim = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  const hs = new Set(HOLIDAYS.map((h) => h.f));
  const nextBiz = (s: string) => nb(s, hs);
  const calcVenc = (em: string, cond: number) => { const r = calcV(em, cond, hs); return { venc: r.venc, vencRaw: r.raw }; };

  const clients: Client[] = CLIENTS.map((c) => ({
    id: c[0], name: c[1], rut: rutFmt(c[2]), giro: c[3], address: c[4], branches: c[5].slice(), cond: c[6],
    contact: { name: c[7], email: c[8], phone: c[9] }, origin: c[10],
    exigeOC: ["walmart", "maui", "imperial"].includes(c[0]), unaOC: c[0] === "walmart", hep: c[0] === "walmart",
    contacts: [{ id: c[0] + "-1", nombre: c[7], cargo: "Encargado/a de pagos", email: c[8], tel: c[9], pagos: true, incorrecto: false }].concat(
      (EXTRA[c[0]] || []).map((e, i) => ({ id: c[0] + "-" + (i + 2), nombre: e[0], cargo: e[1], email: e[2], tel: e[3], pagos: e[4], incorrecto: e[5] })),
    ),
  }));
  const weights: Record<string, number> = Object.fromEntries(CLIENTS.map((c) => [c[0], c[11]]));
  const byId = Object.fromEntries(clients.map((c) => [c.id, c]));

  type Partial2 = Partial<Invoice> & { folio: number; emision: string; clientId: string; neto: number; cond: number; servicio: string; paid?: string | null };
  const invoices: Invoice[] = [];
  const mk = (o: Partial2): Invoice => {
    const { paid: _p, ...rest } = o;
    const inv = { payments: [], refs: [], events: [], files: [], gestiones: [], obs: "", anulada: false, nc: null, sucursal: "", plan: null, envio: { estado: "No enviada" }, venc: "", vencRaw: "", iva: 0, total: 0, ...rest } as Invoice;
    if (!rest.venc) Object.assign(inv, calcVenc(inv.emision, inv.cond));
    else if (!rest.vencRaw) inv.vencRaw = inv.venc;
    inv.iva = Math.round(inv.neto * 0.19);
    inv.total = inv.neto + inv.iva;
    invoices.push(inv);
    return inv;
  };
  let pid = 1;
  const pay = (inv: Invoice, fecha: string, monto: number, medio?: string, nota?: string, rec?: string) => {
    const comp = String(ri(1000000, 9999999));
    inv.payments.push({ id: "p" + pid++, fecha, monto, medio: medio || "Transferencia", comp, nota: nota || "", recibidoPor: rec || pickW(RECIBIDOS, REC_W), file: { name: "Comprobante_" + comp + (R() < 0.6 ? ".pdf" : ".jpg") } });
  };
  const COT = (n: number): Ref => ({ tipo: "Cotización DMC", num: "COT-" + n });
  const OC = (n: number): Ref => ({ tipo: "OC cliente", num: String(n) });
  const HEP = (n: number): Ref => ({ tipo: "HEP", num: "HEP " + n });

  const SP: Partial2[] = [
    { folio: 12163, emision: "2026-10-23", clientId: "walmart", sucursal: "Líder 88 Los Dominicos", servicio: "Instalación", neto: 4250000, cond: 30, refs: [COT(20896), OC(4503270183), HEP(1004712)] },
    { folio: 12153, emision: "2026-10-14", clientId: "walmart", sucursal: "Líder 71 Vespucio", servicio: "Instalación", neto: 17133240, cond: 30, refs: [COT(20871), OC(4503245094), HEP(1004587)] },
    { folio: 12154, emision: "2026-10-14", clientId: "walmart", sucursal: "SBA 579 Lampa", servicio: "Instalación", neto: 3835250, cond: 30, refs: [COT(20874), OC(4503233892)] },
    { folio: 12145, emision: "2026-10-14", clientId: "cannon", sucursal: "Cannon Plaza Sur", servicio: "Venta de equipos", neto: 3144991, cond: 30, refs: [COT(20862), OC(2560)] },
    { folio: 12159, emision: "2026-10-14", clientId: "lippi", sucursal: "Lippi Buenaventura", servicio: "Venta de equipos", neto: 2970000, cond: 30, refs: [COT(20901), OC(8967)] },
    { folio: 12146, emision: "2026-10-14", clientId: "central", sucursal: "", servicio: "Mantención", neto: 2016807, cond: 30, refs: [COT(20866), OC(208301)] },
    { folio: 12143, emision: "2026-10-09", clientId: "gianca", sucursal: "", servicio: "Venta de equipos", neto: 1944990, cond: 0, refs: [COT(20815)], paid: "2026-10-09" },
    { folio: 12144, emision: "2026-10-09", clientId: "ark", sucursal: "", servicio: "Venta de equipos", neto: 1487490, cond: 0, refs: [COT(20957)] },
    { folio: 12139, emision: "2026-10-07", clientId: "kmc", sucursal: "Líder 674 Pedro Fontova", servicio: "Instalación", neto: 1404750, cond: 30, refs: [COT(20833), OC(1348930)], plan: { id: "PL-004", n: 1, of: 2 }, obs: "Trabajo en Líder 674; la guía está a nombre de Walmart, se factura al receptor KMC." },
    { folio: 12157, emision: "2026-10-14", clientId: "nike", sucursal: "Nike Parque Arauco", servicio: "Plan calibración", neto: 1200000, cond: 30, refs: [COT(20640), OC(4540074827)], plan: { id: "PL-002", n: 10, of: 12 } },
    { folio: 12111, emision: "2026-10-01", clientId: "maui", sucursal: "Maui Costanera", servicio: "Calibración", neto: 1150000, cond: 30, venc: "2026-10-30", refs: [COT(20845), OC(955)], obs: "Vencimiento ajustado a pedido del cliente (cierre de mes)." },
    { folio: 12135, emision: "2026-10-07", clientId: "importotal", sucursal: "", servicio: "Venta de equipos", neto: 1250000, cond: 30, refs: [COT(20969)], anulada: true, nc: { num: "1490", fecha: "2026-10-08", motivo: "Error en datos", detalle: "Error en razón social; se reemite.", file: { name: "NC_1490.pdf" } } },
    { folio: 12150, emision: "2026-10-16", clientId: "walmart", sucursal: "Ekono 412 Maipú", servicio: "Mantención", neto: 2140000, cond: 30, refs: [COT(20880), OC(4503262201)], anulada: true, nc: { num: "1491", fecha: "2026-10-20", motivo: "Rechazo Walmart – N° incorrecto", detalle: "El portal rechazó la factura: el N° de OC no corresponde. Se reemite con la OC correcta.", file: { name: "NC_1491.pdf" } } },
    { folio: 11939, emision: "2026-08-10", clientId: "trebol", sucursal: "Trébol Chillán", servicio: "Instalación", neto: 23398000, cond: 30, refs: [COT(20512), OC(77120)], obs: "Acuerdo de pago en 3 abonos sobre la misma factura." },
    { folio: 11918, emision: "2026-07-27", clientId: "ahumada", sucursal: "Ahumada 1021 Huérfanos", servicio: "Mantención", neto: 6240500, cond: 60, refs: [COT(20488), OC(3300981)] },
    { folio: 11919, emision: "2026-07-27", clientId: "ahumada", sucursal: "Ahumada 410 Concepción", servicio: "Mantención", neto: 4480510, cond: 60, refs: [COT(20489), OC(3300982)] },
    { folio: 11981, emision: "2026-09-02", clientId: "nike", sucursal: "Nike Easton", servicio: "Venta de equipos", neto: 3010000, cond: 30, refs: [COT(20701), OC(4540071190)] },
    { folio: 12011, emision: "2026-09-10", clientId: "fernapet", sucursal: "Fernapet Ñuñoa", servicio: "Instalación", neto: 1829380, cond: 30, refs: [COT(20744)] },
    { folio: 12088, emision: "2026-09-23", clientId: "puma", sucursal: "Puma Mall Plaza Vespucio", servicio: "Venta de equipos", neto: 2380000, cond: 30, refs: [COT(20788), OC(5561)] },
    { folio: 12090, emision: "2026-09-21", clientId: "walmart", sucursal: "Express 133 Ñuñoa", servicio: "Mantención", neto: 1890000, cond: 30, refs: [COT(20779), OC(4503251187)] },
    { folio: 11872, emision: "2026-07-15", clientId: "urco", sucursal: "", servicio: "Instalación", neto: 4200000, cond: 0, refs: [COT(20420)], plan: { id: "PL-001", n: 1, of: 3 }, paid: "2026-07-15" },
    { folio: 11931, emision: "2026-08-14", clientId: "urco", sucursal: "", servicio: "Instalación", neto: 4200000, cond: 30, refs: [COT(20420)], plan: { id: "PL-001", n: 2, of: 3 }, paid: "2026-09-11" },
    { folio: 11932, emision: "2026-08-14", clientId: "urco", sucursal: "", servicio: "Instalación", neto: 4200000, cond: 60, refs: [COT(20420)], plan: { id: "PL-001", n: 3, of: 3 } },
  ];
  const RANGES: [number, number][] = [[11640, 11679], [11680, 11717], [11718, 11746], [11747, 11784], [11785, 11828], [11829, 11856], [11857, 11904], [11905, 11960], [11961, 12110]];
  const bizDay = (m: number, d: number) => nextBiz("2026-" + pad(m + 1) + "-" + pad(d));
  const nikeF: number[] = [], adiF: number[] = [];
  for (let m = 0; m <= 8; m++) {
    const em = bizDay(m, 5), f = RANGES[m][0] + 5; nikeF.push(f);
    SP.push({ folio: f, emision: em, clientId: "nike", sucursal: "Nike Parque Arauco", servicio: "Plan calibración", neto: 1200000, cond: 30, refs: [COT(20640), OC(4540060000 + 311 * (m + 1))], plan: { id: "PL-002", n: m + 1, of: 12 }, paid: m < 8 ? addDays(calcVenc(em, 30).venc, ri(-4, 6)) : "2026-10-02" });
  }
  for (let m = 6; m <= 8; m++) {
    const em = bizDay(m, 8), f = RANGES[m][0] + 8; adiF.push(f);
    SP.push({ folio: f, emision: em, clientId: "adidas", sucursal: "Adidas Alto Las Condes", servicio: "Plan calibración", neto: 980000, cond: 30, refs: [COT(20690), OC(81000 + m)], plan: { id: "PL-003", n: m - 5, of: 6 }, paid: m < 8 ? addDays(calcVenc(em, 30).venc, ri(0, 8)) : null });
  }
  nikeF.push(12157);
  SP.forEach((o) => { const p = o.paid; const inv = mk(o); inv.events.push({ fecha: inv.emision, user: USR, text: "Factura creada" }); if (p) pay(inv, p, inv.total, "Transferencia", "", "Facturación"); });
  const F = (f: number) => invoices.find((i) => i.folio === f)!;
  F(11939).payments.push({ id: "p" + pid++, fecha: "2026-09-12", monto: 9281207, medio: "Transferencia", comp: "8812044", nota: "Abono 1 de 3 (acuerdo de pago)", recibidoPor: "Gustavo (gerencia)", file: { name: "Comprobante_8812044.pdf" } });
  F(12011).payments.push({ id: "p" + pid++, fecha: "2026-10-05", monto: 1088481, medio: "Transferencia", comp: "5520193", nota: "Abono 50 %", recibidoPor: "Cliente directo", file: { name: "Comprobante_5520193.jpg" } });

  const MONTHS = [146.7, 132.5, 96.5, 127.7, 156.2, 97.6, 168.6, 148.7, 122.7, 63.0].map((x) => Math.round(x * 1e6));
  const used = new Set(invoices.map((i) => i.folio));
  const cs = clients.filter((c) => c.id !== "urco");
  const cIds = cs.map((c) => c.id), cW = cs.map((c) => weights[c.id]);
  const busy = (m: number, d: number) => { let s = "2026-" + pad(m + 1) + "-" + pad(d); const wd = D(s).getUTCDay(); if (wd === 6) s = addDays(s, d > 2 ? -1 : 2); if (wd === 0) s = addDays(s, d > 2 ? -2 : 1); return nextBiz(s); };
  const refFor = (c: Client): Ref[] => {
    const out: Ref[] = [];
    if (R() < 0.93) out.push(COT(ri(20300, 20990)));
    const pOC = c.id === "walmart" ? 0.94 : c.id === "nike" ? 1 : c.exigeOC ? 0.9 : 0.55;
    if (R() < pOC) out.push(OC(c.id === "walmart" ? 4503200000 + ri(10000, 89999) : c.id === "nike" ? 4540060000 + ri(1000, 19999) : ri(1000, 9999999)));
    if (c.hep && R() < 0.35) out.push(HEP(ri(1003000, 1004900)));
    return out;
  };
  const genAn: Invoice[] = [];
  for (let m = 0; m <= 9; m++) {
    let folios: number[] = [];
    if (m < 9) { const [a, b] = RANGES[m]; if (m === 8) { for (let i = 0; i < 46; i++) folios.push(a + Math.round((i * (b - a)) / 45)); } else for (let f = a; f <= b; f++) folios.push(f); }
    else for (let f = 12136; f <= 12163; f++) folios.push(f);
    folios = folios.filter((f) => !used.has(f));
    const anIdx = m < 9 ? ri(0, folios.length - 1) : -1;
    const spSum = invoices.filter((i) => +i.emision.slice(5, 7) - 1 === m && !i.anulada).reduce((a, i) => a + i.neto, 0);
    const target = MONTHS[m] - spSum;
    const gen = folios.filter((_, i) => i !== anIdx);
    const ws = gen.map(() => Math.exp((R() + R() + R() - 1.5) * 1.6));
    const wsum = ws.reduce((a, b) => a + b, 0);
    let acc = 0;
    folios.forEach((folio, idx) => {
      used.add(folio);
      const c = byId[pickW(cIds, cW)];
      const emision = busy(m, m === 9 ? ri(1, 23) : ri(1, dim(2026, m)));
      const isAn = idx === anIdx;
      let neto: number;
      if (isAn) neto = ri(40, 260) * 10000;
      else { const gi = gen.indexOf(folio); neto = gi === gen.length - 1 ? target - acc : Math.round((target * ws[gi]) / wsum / 10) * 10; acc += neto; }
      const inv = mk({ folio, emision, clientId: c.id, sucursal: c.branches.length ? c.branches[ri(0, c.branches.length - 1)] : "", servicio: pickW(SERVICES, SVC_W), neto, cond: c.cond, refs: refFor(c) });
      inv.events.push({ fecha: emision, user: USR, text: "Factura creada" });
      if (isAn) { inv.anulada = true; genAn.push(inv); return; }
      const age = diffDays(TODAY, inv.venc);
      let pPaid = inv.venc > TODAY ? (m === 9 ? 0.08 : 0.25) : age > 90 ? 0.975 : age > 60 ? 0.93 : age > 30 ? 0.9 : 0.74;
      if (m === 9 && inv.cond === 0) pPaid = 0.7;
      if (R() < pPaid) {
        let pd = addDays(inv.venc, ri(-12, 20));
        if (pd <= emision) pd = addDays(emision, ri(1, 6));
        if (pd >= TODAY) pd = addDays(TODAY, -ri(1, 5));
        if (pd <= emision) pd = emision;
        if (R() < 0.07 && diffDays(TODAY, pd) > 20) {
          const h1 = Math.round(inv.total / 2);
          pay(inv, addDays(pd, -15) > emision ? addDays(pd, -15) : emision, h1, pickW(MEDIOS, MED_W), "Abono");
          pay(inv, pd, inv.total - h1, pickW(MEDIOS, MED_W), "Saldo");
        } else pay(inv, pd, inv.total, pickW(MEDIOS, MED_W));
      } else if (inv.venc < TODAY && R() < 0.18) pay(inv, addDays(inv.venc, ri(0, Math.min(age - 1, 20))), Math.round((inv.total * (0.3 + R() * 0.3)) / 10) * 10, "Transferencia", "Abono");
    });
  }
  genAn.sort((a, b) => (a.emision < b.emision ? -1 : 1)).forEach((inv, k) => {
    const num = String(1481 + k);
    const motivo = inv.clientId === "walmart" ? "Rechazo Walmart – N° incorrecto" : pick(["Error en monto", "Error en datos", "Error en monto", "Otro"]);
    inv.nc = { num, fecha: nextBiz(addDays(inv.emision, 2)), motivo, detalle: motivo === "Otro" ? "Cliente solicitó facturar a otra razón social del grupo." : motivo === "Error en monto" ? "Monto mal ingresado; se reemite." : "", file: { name: "NC_" + num + ".pdf" } };
  });

  const RES: Record<string, string[]> = {
    Correo: ["Se envía recordatorio con factura y OC adjunta.", "Sin respuesta al correo.", "Responden que está en proceso de pago."],
    WhatsApp: ["Mensaje leído, sin respuesta.", "Indican que revisarán con tesorería.", "Piden reenviar la factura en PDF."],
    "Otros contactos": ["Se escribe a administración / jefe de local.", "Derivan a nuevo encargado de pagos."],
    Llamada: ["No contesta; se deja recado.", "Confirman que pagará en la próxima nómina."],
  };
  const G = (fecha: string, hora: string, canal: string, contacto: string, resultado: string, compromiso?: Gestion["compromiso"]): Gestion => ({ fecha, hora, canal: canal as Gestion["canal"], contacto, resultado, compromiso: compromiso || null, user: USR });
  const SPG: Record<number, Gestion[]> = {
    11939: [G("2026-09-11", "10:15", "Correo", "Patricio Vera (Encargado/a de pagos)", "Se envía factura y OC; solicitan pagar en 3 abonos."), G("2026-09-18", "12:40", "WhatsApp", "Patricio Vera (Encargado/a de pagos)", "Confirma abono 1 recibido; segundo abono a fin de octubre."), G("2026-10-20", "16:05", "Llamada", "Patricio Vera (Encargado/a de pagos)", "Confirma transferencia del segundo abono.", { fecha: "2026-10-30", hora: "10:00", monto: 9281207, texto: "Transfiere abono 2 de 3" })],
    11918: [G("2026-09-28", "09:30", "Correo", "Daniela Fuentes (Encargado/a de pagos)", "Se envía recordatorio con factura y OC."), G("2026-10-05", "11:10", "WhatsApp", "Daniela Fuentes (Encargado/a de pagos)", "Indica que está en revisión de contraloría."), G("2026-10-14", "15:20", "Otros contactos", "Jorge Lillo (Contraloría)", "Contraloría aprueba el folio 11918."), G("2026-10-26", "09:40", "Llamada", "Daniela Fuentes (Encargado/a de pagos)", "Liberan el pago en la nómina de mañana.", { fecha: "2026-10-27", hora: "13:00", monto: 7426195, texto: "Envía comprobante mañana 13:00" })],
    11919: [G("2026-09-28", "09:30", "Correo", "Daniela Fuentes (Encargado/a de pagos)", "Se envía recordatorio con factura y OC."), G("2026-10-05", "11:10", "WhatsApp", "Daniela Fuentes (Encargado/a de pagos)", "Indica que está en revisión de contraloría."), G("2026-10-14", "15:20", "Otros contactos", "Jorge Lillo (Contraloría)", "Folio 11919 queda para la nómina siguiente.")],
    12011: [G("2026-10-14", "10:00", "Correo", "Fernanda Paredes (Encargado/a de pagos)", "Se envía recordatorio del saldo."), G("2026-10-16", "17:30", "WhatsApp", "Fernanda Paredes (Encargado/a de pagos)", "Compromete el saldo para el jueves.", { fecha: "2026-10-22", hora: "11:00", monto: 1088481, texto: "Transfiere el saldo y envía comprobante" })],
    12144: [G("2026-10-13", "10:20", "Correo", "Andrea Reyes (Encargado/a de pagos)", "Se envía factura y cotización."), G("2026-10-20", "12:00", "WhatsApp", "Andrea Reyes (Encargado/a de pagos)", "Mensaje leído, sin respuesta.")],
    11932: [G("2026-10-15", "09:50", "Correo", "Rodrigo Urrutia (Encargado/a de pagos)", "Se envía recordatorio de la cuota 3/3."), G("2026-10-21", "13:15", "WhatsApp", "Rodrigo Urrutia (Encargado/a de pagos)", "Indica que revisará con administración de obra.")],
    11981: [],
  };

  invoices.forEach((inv) => {
    const files = [{ name: "Factura_" + inv.folio + ".pdf", size: "84 KB", kind: "Factura" }, { name: "DTE_" + inv.folio + ".xml", size: "12 KB", kind: "XML" }];
    const oc = inv.refs.find((r) => r.tipo === "OC cliente"), cot = inv.refs.find((r) => r.tipo === "Cotización DMC");
    if (oc) files.push({ name: "OC_" + oc.num + ".pdf", size: "126 KB", kind: "OC" });
    if (cot) files.push({ name: cot.num + ".pdf", size: "210 KB", kind: "Cotización" });
    inv.files = files;
    if (!inv.envio || inv.envio.estado !== "Enviada") {
      const c = byId[inv.clientId];
      const recent = inv.emision >= "2026-10-19";
      inv.envio = inv.anulada || (recent && R() < 0.5) ? { estado: "No enviada" } : { estado: "Enviada", fecha: nextBiz(addDays(inv.emision, ri(0, 1))), canal: c.hep ? "Portal Walmart" : R() < 0.85 ? "Correo" : "WhatsApp" };
    }
    if (inv.folio === 12163) inv.envio = { estado: "No enviada" };
    if (inv.anulada) { inv.events.push({ fecha: inv.nc!.fecha, user: USR, text: "Factura anulada · NC " + inv.nc!.num + " · " + inv.nc!.motivo }); return; }
    const paid = inv.payments.reduce((a, p) => a + p.monto, 0);
    const open = paid < inv.total && inv.venc < TODAY;
    if (open) {
      inv.events.push({ fecha: nextBiz(addDays(inv.venc, 1)), user: "Sistema", text: "Pasó a En cobranza (automático)" });
      if (SPG[inv.folio]) inv.gestiones = SPG[inv.folio];
      else {
        const age = diffDays(TODAY, inv.venc), c = byId[inv.clientId], out: Gestion[] = [];
        const step = (k: number, off: number) => { const f = nextBiz(addDays(inv.venc, off)); if (f < TODAY) { const ct = k === 2 && c.contacts[1] ? c.contacts[1] : c.contacts[0]; out.push(G(f, pad(ri(9, 17)) + ":" + pick(["00", "15", "30", "45"]), CANAL[k], ct.nombre + " (" + ct.cargo + ")", pick(RES[CANAL[k]]))); } };
        if (age > 4) step(0, 2);
        if (age > 10) step(1, 8);
        if (age > 25) step(2, 20);
        if (age > 40) step(3, 35);
        if (out.length && R() < 0.25) out.pop();
        inv.gestiones = out;
      }
    }
    inv.payments.forEach((p: Payment) => inv.events.push({ fecha: p.fecha, user: USR, text: "Pago registrado $ " + p.monto.toLocaleString("es-CL") + " · " + p.medio + " · recibido por " + p.recibidoPor }));
    inv.gestiones.forEach((g) => inv.events.push({ fecha: g.fecha, user: USR, text: "Gestión de cobranza · " + g.canal + " · " + g.contacto }));
    if (inv.envio.estado === "Enviada") inv.events.push({ fecha: inv.envio.fecha!, user: USR, text: "Factura enviada al cliente · " + inv.envio.canal });
    inv.events.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  });
  invoices.sort((a, b) => b.folio - a.folio);

  const plans: Plan[] = [
    { id: "PL-001", clientId: "urco", nombre: "URCO – Sistema EAS bodega Quilicura", tipo: "cuotas", servicio: "Instalación", sucursal: "", refs: [COT(20420)], cuotas: [{ n: 1, neto: 4200000, cond: 0, folio: 11872, fechaPlan: "2026-07-15" }, { n: 2, neto: 4200000, cond: 30, folio: 11931, fechaPlan: "2026-08-14" }, { n: 3, neto: 4200000, cond: 60, folio: 11932, fechaPlan: "2026-08-14" }] },
    { id: "PL-002", clientId: "nike", nombre: "Plan calibración anual Nike 2026", tipo: "calibracion", servicio: "Plan calibración", sucursal: "Nike Parque Arauco", refs: [COT(20640)], cuotas: Array.from({ length: 12 }, (_, m) => ({ n: m + 1, neto: 1200000, cond: 30, folio: nikeF[m] || null, fechaPlan: m === 9 ? "2026-10-14" : bizDay(m, 5) })) },
    { id: "PL-003", clientId: "adidas", nombre: "Plan calibración Adidas · 2º semestre", tipo: "calibracion", servicio: "Plan calibración", sucursal: "Adidas Alto Las Condes", refs: [COT(20690)], cuotas: Array.from({ length: 6 }, (_, k) => ({ n: k + 1, neto: 980000, cond: 30, folio: adiF[k] || null, fechaPlan: bizDay(k + 6, 8) })) },
    { id: "PL-004", clientId: "kmc", nombre: "KMC – Antenas Líder 674 Pedro Fontova", tipo: "cuotas", servicio: "Instalación", sucursal: "Líder 674 Pedro Fontova", refs: [COT(20833), OC(1348930)], cuotas: [{ n: 1, neto: 1404750, cond: 30, folio: 12139, fechaPlan: "2026-10-07" }, { n: 2, neto: 1404750, cond: 30, folio: null, fechaPlan: "2026-10-30" }] },
  ];

  const ocs: OcSinFactura[] = [
    { num: "4503280011", tipo: "OC cliente", clientId: "walmart", sucursal: "Líder 92 La Florida", monto: 8240000, fecha: "2026-10-20" },
    { num: "4540081120", tipo: "OC cliente", clientId: "nike", sucursal: "Nike Costanera", monto: 2350000, fecha: "2026-10-19" },
    { num: "COT-21004", tipo: "Cotización DMC", clientId: "imperial", sucursal: "Imperial Santa Rosa", monto: 4120000, fecha: "2026-10-22" },
  ];
  const users: AppUser[] = [
    { id: "u1", name: "María José González", ini: "MG", email: "mjgonzalez@grupodmc.example", role: "fact", active: true },
    { id: "u2", name: "Gustavo Herrera", ini: "GH", email: "gherrera@grupodmc.example", role: "ger", active: true },
    { id: "u3", name: "Andrés Muñoz", ini: "AM", email: "amunoz@grupodmc.example", role: "admin", active: true },
    { id: "u4", name: "Camila Soto", ini: "CS", email: "csoto@grupodmc.example", role: "fact", active: false },
  ];
  const y2025 = [98.2, 104.5, 88.1, 112.3, 121.0, 95.4, 130.8, 119.6, 108.9, 109.8, 118.4, 141.2].map((x) => Math.round(x * 1e6));

  return {
    invoices, clients, plans, ocs, users, y2025, ncNext: 1492,
    config: {
      holidays: HOLIDAYS,
      metas: Array(12).fill(150_000_000),
      minimos: Array(12).fill(100_000_000),
      catalogs: { services: SERVICES.slice(), medios: MEDIOS.slice(), conds: [0, 30, 60], recibidos: RECIBIDOS.slice(), motivosNC: MOTIVOS.slice() },
      emailTpl: EMAIL_TPL,
      envioTpl: ENVIO_TPL,
    },
  };
}
