export type Role = "fact" | "ger" | "admin";
export type RefTipo = "Cotización DMC" | "OC cliente" | "HEP";
export type Canal = "Correo" | "WhatsApp" | "Otros contactos" | "Llamada";
export type EnvioCanal = "Correo" | "Portal Walmart" | "WhatsApp";
export type Status = "Pendiente" | "En cobranza" | "Pago parcial" | "Pagada" | "Anulada";

export interface Contact {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
  tel: string;
  pagos: boolean;
  incorrecto: boolean;
}

export interface Client {
  id: string;
  name: string;
  rut: string;
  giro: string;
  address: string;
  branches: string[];
  cond: number;
  contact: { name: string; email: string; phone: string };
  contacts: Contact[];
  origin: "core" | "local";
  exigeOC: boolean;
  unaOC: boolean;
  hep: boolean;
}

export interface Ref { tipo: RefTipo; num: string }
export interface FileMeta { name: string; size?: string; kind?: string }

export interface Payment {
  id: string;
  fecha: string;
  monto: number;
  medio: string;
  comp: string;
  nota: string;
  recibidoPor: string;
  file: FileMeta | null;
}

export interface Compromiso { fecha: string; hora: string; monto: number; texto: string }
export interface Gestion {
  fecha: string;
  hora: string;
  canal: Canal;
  contacto: string;
  resultado: string;
  compromiso: Compromiso | null;
  user: string;
}
export interface Evento { fecha: string; user: string; text: string }
export interface NotaCredito { num: string; fecha: string; motivo: string; detalle: string; file: FileMeta }
export interface Envio { estado: "Enviada" | "No enviada"; fecha?: string; canal?: EnvioCanal }
export interface PlanRef { id: string; n: number; of: number }

export interface Invoice {
  folio: number;
  emision: string;
  clientId: string;
  sucursal: string;
  servicio: string;
  neto: number;
  iva: number;
  total: number;
  cond: number;
  venc: string;
  vencRaw: string;
  refs: Ref[];
  files: FileMeta[];
  obs: string;
  payments: Payment[];
  gestiones: Gestion[];
  events: Evento[];
  anulada: boolean;
  nc: NotaCredito | null;
  envio: Envio;
  plan: PlanRef | null;
}

export interface PlanQuota { n: number; neto: number; cond: number; folio: number | null; fechaPlan: string }
export interface Plan {
  id: string;
  clientId: string;
  nombre: string;
  tipo: "cuotas" | "calibracion";
  servicio: string;
  sucursal: string;
  refs: Ref[];
  cuotas: PlanQuota[];
}

export interface OcSinFactura {
  num: string;
  tipo: string;
  clientId: string;
  sucursal: string;
  monto: number;
  fecha: string;
}

export interface AppUser { id: string; name: string; ini: string; email: string; role: Role; active: boolean }
export interface Holiday { f: string; n: string }

export interface Catalogs {
  services: string[];
  medios: string[];
  conds: number[];
  recibidos: string[];
  motivosNC: string[];
}

export interface Config {
  holidays: Holiday[];
  metas: number[];
  minimos: number[];
  catalogs: Catalogs;
  emailTpl: string;
  envioTpl: string;
}

/** Instantánea serializable que viaja al cliente (sin secretos). */
export interface Snapshot {
  today: string;
  invoices: Invoice[];
  clients: Client[];
  plans: Plan[];
  ocs: OcSinFactura[];
  users: AppUser[];
  config: Config;
  ncNext: number;
  y2025: number[];
}

export interface SessionUser { id: string; name: string; ini: string; email: string; role: Role }

/** Factura con campos derivados (estado, saldo, cobranza…). */
export interface Row extends Invoice {
  paid: number;
  saldo: number;
  status: Status;
  dias: number;
  diasCob: number;
  cobDesde: string | null;
  nivel: number;
  lastG: Gestion | null;
  comp: Gestion | null;
  compEstado: "cumplido" | "incumplido" | "hoy" | "futuro" | null;
  localOwner: string | null;
  lastPay: Payment | null;
  hasOC: boolean;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
