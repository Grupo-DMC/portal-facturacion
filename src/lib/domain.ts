import type { Canal, Client, Config, Gestion, Invoice, Plan, Row, Snapshot, Status } from "./types";

// ───────────── Fechas (YYYY-MM-DD, siempre en UTC para no depender de la zona horaria) ─────────────
export const D = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const S = (dt: Date) => dt.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => {
  const d = D(s);
  d.setUTCDate(d.getUTCDate() + n);
  return S(d);
};
export const diffDays = (a: string, b: string) => Math.round((D(a).getTime() - D(b).getTime()) / 864e5);
export const isIsoDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && S(D(s)) === s;

/** Primer día hábil >= s (lun–vie y no feriado). */
export function nextBiz(s: string, holidays: Set<string>) {
  let x = s;
  for (let k = 0; k < 15; k++) {
    const wd = D(x).getUTCDay();
    if (wd === 0 || wd === 6 || holidays.has(x)) x = addDays(x, 1);
    else break;
  }
  return x;
}

export function calcVenc(emision: string, cond: number, holidays: Set<string>) {
  if (!emision) return { venc: "", raw: "" };
  if (+cond === 0) return { venc: emision, raw: emision };
  const raw = addDays(emision, +cond);
  return { venc: nextBiz(raw, holidays), raw };
}

export const holidaySet = (c: Config) => new Set(c.holidays.map((h) => h.f));

// ───────────── RUT chileno ─────────────
export function rutDv(n: number) {
  const s = String(n);
  let sum = 0,
    m = 2;
  for (let i = s.length - 1; i >= 0; i--) {
    sum += +s[i] * m;
    m = m === 7 ? 2 : m + 1;
  }
  const r = 11 - (sum % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}
export const rutFmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + rutDv(n);
export const rutClean = (v: string) => String(v || "").replace(/[^0-9kK]/g, "").toUpperCase();

export function rutState(v: string) {
  const c = rutClean(v);
  if (c.length < 2) return { ok: false, msg: "", fmt: v };
  const body = c.slice(0, -1);
  const dv = c.slice(-1);
  if (!/^\d{6,9}$/.test(body)) return { ok: false, msg: "RUT inválido", fmt: v };
  const ok = rutDv(+body) === dv;
  return { ok, msg: ok ? "RUT válido" : `Dígito verificador incorrecto (debería ser ${rutDv(+body)})`, fmt: rutFmt(+body).slice(0, -1) + dv };
}

// ───────────── Cobranza ─────────────
export const CANALES: { canal: Canal; icon: "mail" | "msg" | "users" | "call" }[] = [
  { canal: "Correo", icon: "mail" },
  { canal: "WhatsApp", icon: "msg" },
  { canal: "Otros contactos", icon: "users" },
  { canal: "Llamada", icon: "call" },
];
export const TRAMOS = ["Por vencer", "1-30", "31-60", "61-90", "+90"];
export const STS: Status[] = ["Pendiente", "En cobranza", "Pago parcial", "Pagada", "Anulada"];

export interface Derived {
  rows: Row[];
  byF: Record<number, Row>;
  cmap: Record<string, Client>;
}

/** Calcula estado, saldo y datos de cobranza de cada factura. Función pura (sirve en servidor y cliente). */
export function derive(s: Pick<Snapshot, "invoices" | "clients" | "config" | "today">): Derived {
  const T = s.today;
  const hs = holidaySet(s.config);
  const cmap: Record<string, Client> = {};
  const brOwner: Record<string, string> = {};
  s.clients.forEach((c) => {
    cmap[c.id] = c;
    c.branches.forEach((b) => (brOwner[b] = c.id));
  });
  const rows: Row[] = s.invoices.map((i: Invoice) => {
    const paid = i.payments.reduce((a, p) => a + p.monto, 0);
    const saldo = i.anulada ? 0 : Math.max(0, i.total - paid);
    let status: Status;
    if (i.anulada) status = "Anulada";
    else if (saldo <= 0) status = "Pagada";
    else if (i.venc < T) status = "En cobranza";
    else if (paid > 0) status = "Pago parcial";
    else status = "Pendiente";
    const lastPay = i.payments.length ? i.payments.reduce((a, p) => (p.fecha >= a.fecha ? p : a)) : null;
    const cobDesde = status === "En cobranza" ? nextBiz(addDays(i.venc, 1), hs) : null;
    const gest = i.gestiones || [];
    const nivel = gest.reduce((a, g) => Math.max(a, CANALES.findIndex((c) => c.canal === g.canal) + 1), 0);
    const lastG = gest.length ? gest[gest.length - 1] : null;
    const comp = gest.filter((g) => g.compromiso).slice(-1)[0] || null;
    let compEstado: Row["compEstado"] = null;
    if (comp && comp.compromiso) {
      const c = comp.compromiso;
      const pd = i.payments.filter((p) => p.fecha >= comp.fecha).reduce((a, p) => a + p.monto, 0);
      compEstado = saldo <= 0 || pd >= c.monto * 0.95 ? "cumplido" : c.fecha < T ? "incumplido" : c.fecha === T ? "hoy" : "futuro";
    }
    const owner = i.sucursal ? brOwner[i.sucursal] : null;
    return {
      ...i,
      paid,
      saldo,
      status,
      dias: diffDays(i.venc, T),
      diasCob: cobDesde ? diffDays(T, i.venc) : 0,
      cobDesde,
      nivel,
      lastG,
      comp,
      compEstado,
      localOwner: owner && owner !== i.clientId ? owner : null,
      lastPay,
      hasOC: i.refs.some((x) => x.tipo === "OC cliente"),
    };
  });
  const byF: Record<number, Row> = {};
  rows.forEach((r) => (byF[r.folio] = r));
  return { rows, byF, cmap };
}

/** Saldo por cobrar a la fecha X ('venc' = solo lo ya vencido a X). */
export function asOf(rows: Row[], X: string, kind?: "venc") {
  let t = 0;
  rows.forEach((r) => {
    if (r.anulada || r.emision > X) return;
    if (kind === "venc" && !(r.venc < X)) return;
    const p = r.payments.filter((p) => p.fecha <= X).reduce((a, p) => a + p.monto, 0);
    t += Math.max(0, r.total - p);
  });
  return t;
}

export const tramo = (r: Row) => {
  if (r.dias >= 0) return 0;
  const o = -r.dias;
  return o <= 30 ? 1 : o <= 60 ? 2 : o <= 90 ? 3 : 4;
};

export const mi = (r: Pick<Invoice, "emision">) => (r.emision.startsWith("2026") ? +r.emision.slice(5, 7) - 1 : -1);

// ───────────── Planes ─────────────
export function planInfo(p: Plan, byF: Record<number, Row>) {
  const cs = p.cuotas.map((q) => {
    const r = q.folio ? byF[q.folio] : null;
    const est = !r ? "Por emitir" : r.status === "Pendiente" ? "Emitida" : r.status;
    return { ...q, r, est };
  });
  const total = cs.reduce((a, q) => a + (q.r ? q.r.total : Math.round(q.neto * 1.19)), 0);
  const paid = cs.reduce((a, q) => a + (q.r ? q.r.paid : 0), 0);
  return { cs, total, paid, emit: cs.filter((q) => q.r).length, pag: cs.filter((q) => q.est === "Pagada").length, next: cs.find((q) => !q.r), of: cs.length };
}

export function draftsDue(plans: Plan[], monthEnd: string) {
  const out: { p: Plan; q: Plan["cuotas"][number] }[] = [];
  plans.forEach((p) => p.cuotas.forEach((q) => {
    if (!q.folio && q.fechaPlan <= monthEnd) out.push({ p, q });
  }));
  return out.sort((a, b) => (a.q.fechaPlan < b.q.fechaPlan ? -1 : 1));
}

// ───────────── Helpers de contacto ─────────────
export function suggestContact(c: Client, canal: Canal) {
  const ok = (c.contacts || []).filter((x) => !x.incorrecto);
  if (canal === "Otros contactos") {
    const o = ok.find((x) => !x.pagos);
    if (o) return o.id;
  }
  const p = ok.find((x) => x.pagos);
  return (p || ok[0] || { id: "" }).id;
}

export const lastGestion = (g: Gestion[]) => (g.length ? g[g.length - 1] : null);

/** Cálculo del IVA 19 %: único punto de verdad (servidor y cliente). */
export const calcIva = (neto: number) => Math.round(neto * 0.19);
