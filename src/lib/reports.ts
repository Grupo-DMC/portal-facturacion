import { diffDays, derive, mi, tramo, TRAMOS } from "./domain";
import { clp, condL, fd, MESL, num } from "./format";
import { INV_COLS, invRow } from "./export";
import type { Snapshot } from "./types";

export type RepKey = "libro" | "pendientes" | "pagadas" | "nc" | "antiguedad" | "servicio" | "cliente" | "estado";
export const REPORTS: { key: RepKey; l: string; d: string; month: boolean; client: boolean }[] = [
  { key: "libro", l: "Libro de facturación mensual", d: "Mismo formato que la planilla actual", month: true, client: false },
  { key: "pendientes", l: "Facturas por cobrar", d: "Pendientes, pago parcial y en cobranza", month: false, client: false },
  { key: "pagadas", l: "Pagadas por período", d: "Según fecha de llegada del comprobante", month: true, client: false },
  { key: "nc", l: "Notas de crédito", d: "Facturas anuladas y su NC de respaldo", month: true, client: false },
  { key: "antiguedad", l: "Antigüedad de deuda", d: "Saldo por receptor y días en cobranza", month: false, client: false },
  { key: "servicio", l: "Facturación por servicio", d: "Neto por tipo de servicio", month: true, client: false },
  { key: "cliente", l: "Facturación por receptor", d: "Neto, total y saldo por receptor", month: true, client: false },
  { key: "estado", l: "Estado de cuenta por cliente", d: "Facturas adeudadas de un cliente (PDF para enviar)", month: false, client: true },
];

export interface ReportOut {
  title: string;
  desc: string;
  period: string;
  cols: { l: string; al: "left" | "right" }[];
  /** texto para mostrar */
  rows: string[][];
  /** valores crudos para Excel */
  raw: (string | number)[][];
  foot: string[];
  note: string;
}

type Src = Pick<Snapshot, "invoices" | "clients" | "config" | "today">;

export function buildReport(src: Src, key: RepKey, month: string, clientId: string): ReportOut {
  const d = derive(src);
  const def = REPORTS.find((r) => r.key === key) ?? REPORTS[0];
  const inM = (e: string) => (month === "all" ? e.startsWith("2026") : mi({ emision: e }) === +month);
  const period = month === "all" ? "Año 2026" : `${MESL[+month] ?? ""} 2026`;
  const A = (l: string, right = false) => ({ l, al: (right ? "right" : "left") as "left" | "right" });
  const out = (cols: ReportOut["cols"], raw: (string | number)[][], fmt: (v: string | number, i: number) => string, foot: string[], note = ""): ReportOut => ({
    title: def.l, desc: def.d, period, cols, raw, rows: raw.map((r) => r.map((v, i) => fmt(v, i))), foot, note,
  });
  const money = (i: number, set: number[]) => set.includes(i);

  if (key === "libro" || key === "pendientes") {
    const rs = d.rows.filter((r) => (key === "libro" ? inM(r.emision) : r.saldo > 0)).sort((a, b) => a.folio - b.folio);
    const act = rs.filter((r) => !r.anulada);
    const MON = [7, 8, 9, 15];
    const raw = rs.map((r) => invRow(r, d.cmap[r.clientId]));
    const sum = (i: number) => raw.reduce((a, r) => a + (typeof r[i] === "number" ? (r[i] as number) : 0), 0);
    return out(INV_COLS.map((l, i) => A(l, MON.includes(i))), raw, (v, i) => (MON.includes(i) ? clp(+v) : String(v)),
      INV_COLS.map((_, i) => (i === 0 ? `Totales · ${act.length} facturas` : MON.includes(i) ? clp(sum(i)) : "")), "Las facturas anuladas figuran en el libro pero no suman a los totales.");
  }
  if (key === "pagadas") {
    const rs = d.rows.filter((r) => r.status === "Pagada" && r.lastPay && (month === "all" ? r.lastPay.fecha.startsWith("2026") : mi({ emision: r.lastPay.fecha }) === +month)).sort((a, b) => (a.lastPay!.fecha < b.lastPay!.fecha ? -1 : 1));
    const raw = rs.map((r) => [r.folio, d.cmap[r.clientId]?.name ?? "", fd(r.emision), fd(r.lastPay!.fecha), r.lastPay!.medio, diffDays(r.lastPay!.fecha, r.emision), r.lastPay!.recibidoPor, r.lastPay!.comp, r.total]);
    return out([A("Folio"), A("Receptor"), A("Emisión"), A("Fecha de pago"), A("Medio"), A("Días en pagar", true), A("Recibido por"), A("Comprobante"), A("Total", true)], raw, (v, i) => (i === 8 ? clp(+v) : String(v)),
      ["", `${rs.length} facturas`, "", "", "", rs.length ? String(Math.round(rs.reduce((a, r) => a + diffDays(r.lastPay!.fecha, r.emision), 0) / rs.length)) : "", "", "", clp(rs.reduce((a, r) => a + r.total, 0))], "Se ordena por fecha de llegada del comprobante.");
  }
  if (key === "nc") {
    const rs = d.rows.filter((r) => r.anulada && r.nc && inM(r.emision)).sort((a, b) => +a.nc!.num - +b.nc!.num);
    const raw = rs.map((r) => [r.nc!.num, fd(r.nc!.fecha), r.folio, d.cmap[r.clientId]?.name ?? "", fd(r.emision), r.nc!.motivo, r.nc!.detalle, r.neto, r.total]);
    return out([A("NC"), A("Fecha NC"), A("Folio anulado"), A("Receptor"), A("Emisión"), A("Motivo"), A("Detalle"), A("Neto", true), A("Total", true)], raw, (v, i) => (i >= 7 ? clp(+v) : String(v)),
      ["", `${rs.length} NC`, "", "", "", "", "", clp(rs.reduce((a, r) => a + r.neto, 0)), clp(rs.reduce((a, r) => a + r.total, 0))]);
  }
  if (key === "antiguedad") {
    const m: Record<string, number[]> = {};
    d.rows.filter((r) => r.saldo > 0).forEach((r) => { (m[r.clientId] ??= [0, 0, 0, 0, 0])[tramo(r)] += r.saldo; });
    const ids = Object.keys(m).sort((a, b) => m[b].reduce((x, y) => x + y, 0) - m[a].reduce((x, y) => x + y, 0));
    const raw = ids.map((id) => [d.cmap[id]?.name ?? id, ...m[id], m[id].reduce((x, y) => x + y, 0)]);
    const tot = [0, 1, 2, 3, 4, 5].map((i) => raw.reduce((a, r) => a + (r[i + 1] as number), 0));
    return out([A("Receptor"), ...TRAMOS.map((t) => A(t, true)), A("Total", true)], raw, (v, i) => (i ? clp(+v) : String(v)), ["Total", ...tot.map(clp)], "Tramos según días transcurridos desde el vencimiento.");
  }
  if (key === "servicio") {
    const rs = d.rows.filter((r) => !r.anulada && inM(r.emision));
    const m: Record<string, { n: number; neto: number; total: number }> = {};
    rs.forEach((r) => { const x = (m[r.servicio] ??= { n: 0, neto: 0, total: 0 }); x.n++; x.neto += r.neto; x.total += r.total; });
    const keys = Object.keys(m).sort((a, b) => m[b].neto - m[a].neto);
    const tn = rs.reduce((a, r) => a + r.neto, 0);
    const raw = keys.map((k) => [k, m[k].n, m[k].neto, m[k].total, tn ? Math.round((m[k].neto / tn) * 1000) / 10 : 0]);
    return out([A("Servicio"), A("Facturas", true), A("Neto", true), A("Total c/IVA", true), A("% del neto", true)], raw, (v, i) => (i === 0 ? String(v) : i === 1 ? num(+v) : i === 4 ? v + " %" : clp(+v)), ["Total", String(rs.length), clp(tn), clp(rs.reduce((a, r) => a + r.total, 0)), "100 %"]);
  }
  if (key === "cliente") {
    const rs = d.rows.filter((r) => !r.anulada && inM(r.emision));
    const m: Record<string, { n: number; neto: number; total: number; saldo: number }> = {};
    rs.forEach((r) => { const x = (m[r.clientId] ??= { n: 0, neto: 0, total: 0, saldo: 0 }); x.n++; x.neto += r.neto; x.total += r.total; x.saldo += r.saldo; });
    const ids = Object.keys(m).sort((a, b) => m[b].neto - m[a].neto);
    const raw = ids.map((id) => [d.cmap[id]?.name ?? id, d.cmap[id]?.rut ?? "", m[id].n, m[id].neto, m[id].total, m[id].saldo]);
    return out([A("Receptor"), A("RUT"), A("Facturas", true), A("Neto", true), A("Total c/IVA", true), A("Saldo", true)], raw, (v, i) => (i < 2 ? String(v) : i === 2 ? num(+v) : clp(+v)),
      ["Total", "", String(rs.length), clp(rs.reduce((a, r) => a + r.neto, 0)), clp(rs.reduce((a, r) => a + r.total, 0)), clp(rs.reduce((a, r) => a + r.saldo, 0))]);
  }
  // estado de cuenta
  const c = d.cmap[clientId];
  const rs = d.rows.filter((r) => r.clientId === clientId && r.saldo > 0).sort((a, b) => (a.venc < b.venc ? -1 : 1));
  const raw = rs.map((r) => [r.folio, fd(r.emision), fd(r.venc), condL(r.cond), r.refs.map((x) => x.num).join(" / "), r.dias < 0 ? -r.dias : 0, r.total, r.paid, r.saldo]);
  const res = out([A("Folio"), A("Emisión"), A("Vencimiento"), A("Condición"), A("Referencias"), A("Días vencida", true), A("Total", true), A("Abonos", true), A("Saldo", true)], raw, (v, i) => (i >= 6 ? clp(+v) : String(v)),
    ["Total adeudado", "", "", "", "", "", "", "", clp(rs.reduce((a, r) => a + r.saldo, 0))], c ? `${c.name} · RUT ${c.rut}` : "Selecciona un cliente");
  res.period = `al ${fd(src.today)}`;
  return res;
}
