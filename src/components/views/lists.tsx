"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Download, Layers, Phone, Plus, Search, Banknote } from "lucide-react";
import { useApp } from "../app-context";
import { Bars, ChartCard, Donut, HBars } from "../charts";
import { Empty, KpiGrid, PageHead, Seg, StatusBadge } from "../ui";
import { diffDays, draftsDue, planInfo, tramo, TRAMOS } from "@/lib/domain";
import { clp, fd, MES, mEnd, mStart, sn } from "@/lib/format";
import { downloadCsv, INV_COLS, invRow } from "@/lib/export";
import { BAD, diasInfo } from "@/lib/view";

// ───────────────────────── Planes de cuotas ─────────────────────────
export function PlanesView() {
  const { snap, d, cmap, month, today: T, canEdit, openModal } = useApp();
  const due = draftsDue(snap.plans, mEnd(month));
  const rows = snap.plans.map((p) => ({ p, i: planInfo(p, d.byF) }));
  const tot = rows.reduce((a, r) => a + r.i.total, 0), paid = rows.reduce((a, r) => a + r.i.paid, 0);
  return (
    <>
      <PageHead title="Planes de cuotas" sub="Cada cuota es una factura · planes de calibración mensuales" actions={canEdit && <button type="button" className="btn btn-primary" onClick={() => openModal({ type: "factura", init: { mode: "new", cuotas: true } })}><Plus size={16} aria-hidden />Facturar en cuotas</button>} />
      {due.length > 0 && <div className="mt-4 flex items-center gap-2.5 px-3.5 py-3 text-sm" style={{ background: "var(--color-warn-bg)", color: "var(--color-warn)" }}><Layers size={16} aria-hidden /><span><b>{due.length} cuotas por emitir este mes</b> · {clp(due.reduce((a, x) => a + x.q.neto, 0))} neto · {due.slice(0, 3).map((x) => `${sn(cmap[x.p.clientId]?.name)} ${x.q.n}/${x.p.cuotas.length}`).join(", ")}{due.length > 3 ? "…" : ""}</span></div>}
      <div className="mt-4"><KpiGrid items={[{ l: "Planes activos", v: String(rows.length), s: `${rows.filter((r) => r.i.next).length} con cuotas por emitir` }, { l: "Cuotas emitidas", v: `${rows.reduce((a, r) => a + r.i.emit, 0)} / ${rows.reduce((a, r) => a + r.i.of, 0)}`, s: "sobre el total de cuotas" }, { l: "Por emitir este mes", v: String(due.length), s: clp(due.reduce((a, x) => a + x.q.neto, 0)) + " neto" }, { l: "Pagado del plan", v: clp(paid), s: `de ${clp(tot)} c/IVA` }]} /></div>
      <div className="scroll-x">
        <table className="tbl" style={{ minWidth: 1100 }}>
          <thead><tr><th>Plan</th><th>Cliente</th><th>Tipo</th><th>Cuotas</th><th>Emitidas</th><th>Pagadas</th><th className="r">Total c/IVA</th><th className="r">Pagado</th><th>Próxima por emitir</th></tr></thead>
          <tbody>
            {rows.map(({ p, i }) => (
              <tr key={p.id} className="click" style={{ height: 48 }} onClick={() => openModal({ type: "plan", id: p.id })}>
                <td className="font-extrabold"><button type="button" className="lnk" onClick={(e) => { e.stopPropagation(); openModal({ type: "plan", id: p.id }); }}>{p.nombre}</button></td>
                <td>{sn(cmap[p.clientId]?.name)}</td>
                <td><span className="tag tag-neutral">{p.tipo === "calibracion" ? "Calibración" : "Cuotas"}</span></td>
                <td><div className="flex max-w-[260px] flex-wrap gap-0.5">{i.cs.map((q) => <span key={q.n} title={`Cuota ${q.n}: ${q.est}`} className={`grid h-4 w-5 place-items-center text-[9px] font-extrabold st-${q.est === "Por emitir" ? "poremitir" : q.est === "Emitida" ? "emitida" : q.est === "Pagada" ? "pagada" : q.est === "En cobranza" ? "cobranza" : q.est === "Pago parcial" ? "parcial" : "anulada"}`}>{q.n}</span>)}</div></td>
                <td>{i.emit}/{i.of}</td><td>{i.pag}/{i.of}</td><td className="r">{clp(i.total)}</td><td className="r font-bold">{clp(i.paid)}</td>
                <td className="font-semibold" style={{ color: i.next && i.next.fechaPlan < T ? BAD : undefined }}>{i.next ? `Cuota ${i.next.n} · ${fd(i.next.fechaPlan)}${i.next.fechaPlan < T ? " (atrasada)" : ""}` : "Completo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ───────────────────────── Órdenes de compra ─────────────────────────
export function OcView() {
  const { d, cmap, snap, canEdit, openModal, openDrawer } = useApp();
  const [q, setQ] = useState(""), [tipo, setTipo] = useState(""), [cli, setCli] = useState(""), [est, setEst] = useState(""), [exige, setExige] = useState(false);
  const refs = useMemo(() => {
    const m = new Map<string, { num: string; tipo: string; clientId: string; folios: number[]; fecha: string; monto: number; saldo: number }>();
    d.rows.forEach((r) => r.refs.forEach((x) => {
      const k = x.tipo + "|" + x.num;
      const e = m.get(k) ?? { num: x.num, tipo: x.tipo, clientId: r.clientId, folios: [], fecha: "", monto: 0, saldo: 0 };
      e.folios.push(r.folio);
      if (r.emision > e.fecha) e.fecha = r.emision;
      if (!r.anulada) { e.monto += r.total; e.saldo += r.saldo; }
      m.set(k, e);
    }));
    return [...m.values()].map((e) => ({ ...e, estado: e.saldo <= 0 ? "Pagada" : e.saldo < e.monto ? "Parcial" : "Pendiente" }));
  }, [d.rows]);
  const sinOC = d.rows.filter((r) => cmap[r.clientId]?.exigeOC && !r.hasOC && !r.anulada);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return refs.filter((r) => (!s || r.num.toLowerCase() === s) && (!tipo || r.tipo === tipo) && (!cli || r.clientId === cli) && (!est || r.estado === est)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [refs, q, tipo, cli, est]);
  const stCls = (e: string) => (e === "Pagada" ? "st-pagada" : e === "Parcial" ? "st-parcial" : "st-pendiente");
  return (
    <>
      <PageHead title="Órdenes de compra" sub="OC cliente · Cotización DMC · HEP" actions={<button type="button" className="btn btn-secondary" onClick={() => downloadCsv("referencias_oc", ["N° referencia", "Tipo", "Cliente", "Facturas", "Última emisión", "Monto facturado", "Saldo", "Estado"], list.map((r) => [r.num, r.tipo, cmap[r.clientId]?.name, r.folios.join(" / "), fd(r.fecha), r.monto, r.saldo, r.estado]))}><Download size={16} aria-hidden />Exportar a Excel</button>} />
      <div className="mt-4 grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))" }}>
        <section className="cell px-4 pb-2.5 pt-4">
          <div className="mb-1.5 flex items-center gap-2"><AlertTriangle size={16} className="text-accent-700" aria-hidden /><h4 className="flex-1 font-extrabold">OC sin factura</h4><span className="text-[13px] font-semibold tabular-nums">{snap.ocs.length} · {clp(snap.ocs.reduce((a, x) => a + x.monto, 0))}</span></div>
          {snap.ocs.map((x) => (
            <div key={x.num} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-neutral-300 py-2 text-[13px]">
              <span><b className="tabular-nums">{x.num}</b> · {sn(cmap[x.clientId]?.name)}<br /><span className="text-xs text-neutral-700">{x.tipo} · recibida {fd(x.fecha)} · {x.sucursal}</span></span>
              <span className="font-bold tabular-nums">{clp(x.monto)}</span>
              {canEdit && <button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal({ type: "factura", init: { mode: "new", clientId: x.clientId, sucursal: x.sucursal, ref: { tipo: x.tipo === "OC cliente" ? "OC cliente" : "Cotización DMC", num: x.num } } })}>Facturar</button>}
            </div>
          ))}
        </section>
        <section className="cell p-4">
          <div className="mb-1.5 flex items-center gap-2"><AlertTriangle size={16} className="text-accent-700" aria-hidden /><h4 className="flex-1 font-extrabold">Facturas sin OC de clientes que la exigen</h4><span className="text-[13px] font-semibold tabular-nums">{sinOC.length} en 2026</span></div>
          {sinOC.slice(0, 4).map((r) => (
            <div key={r.folio} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-neutral-300 py-2 text-[13px]">
              <span><button type="button" className="lnk" onClick={() => openDrawer(r.folio)}>{r.folio}</button> · {sn(cmap[r.clientId]?.name)}<br /><span className="text-xs text-neutral-700">Emitida {fd(r.emision)} · {r.refs.map((x) => x.num).join(", ") || "sin referencias"}</span></span>
              <span className="font-bold tabular-nums">{clp(r.total)}</span>
              {canEdit && <button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal({ type: "factura", init: { mode: "edit", folio: r.folio } })}>Completar</button>}
            </div>
          ))}
          {!sinOC.length && <p className="border-t border-neutral-300 py-2.5 text-[13px] text-neutral-700">Todas las facturas de estos clientes tienen OC.</p>}
        </section>
      </div>
      <div className="my-3 flex flex-wrap items-center gap-2">
        <div className="relative w-[260px]"><Search size={16} className="pointer-events-none absolute left-2.5 top-2.5 text-neutral-700" aria-hidden /><input className="input !pl-[34px] tabular-nums" aria-label="N° exacto de OC o cotización" value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° exacto de OC o cotización" /></div>
        <select className="input !w-auto" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos los tipos</option><option>OC cliente</option><option>Cotización DMC</option><option>HEP</option></select>
        <select className="input !w-auto max-w-[220px]" aria-label="Cliente" value={cli} onChange={(e) => setCli(e.target.value)}><option value="">Todos los clientes</option>{snap.clients.map((c) => <option key={c.id} value={c.id}>{sn(c.name)}</option>)}</select>
        <select className="input !w-auto" aria-label="Estado de pago" value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todo estado de pago</option><option>Pendiente</option><option>Parcial</option><option>Pagada</option></select>
        <label className="flex cursor-pointer items-center gap-2 border px-2.5 py-1.5 text-[13px] font-semibold" style={{ borderColor: exige ? "var(--color-accent)" : "var(--color-divider)", background: exige ? "var(--color-accent-100)" : "transparent" }}><input type="checkbox" className="size-[15px]" checked={exige} onChange={(e) => setExige(e.target.checked)} />Ver facturas sin OC (clientes que la exigen) <b className="text-accent-700">{sinOC.length}</b></label>
        <span className="text-xs text-neutral-700">{exige ? `${sinOC.length} facturas` : `${list.length} referencias`}</span>
      </div>
      <div className="scroll-x" style={{ maxHeight: "calc(100vh - 260px)" }}>
        {exige ? (
          <table className="tbl sticky-head" style={{ minWidth: 800 }}><thead><tr><th>Folio</th><th>Cliente</th><th>Emisión</th><th>Referencias</th><th>Estado</th><th className="r">Total</th></tr></thead><tbody>
            {sinOC.map((r) => <tr key={r.folio} className="click" onClick={() => openDrawer(r.folio)}><td className="font-extrabold">{r.folio}</td><td className="font-semibold">{sn(cmap[r.clientId]?.name)}</td><td>{fd(r.emision)}</td><td className="text-accent-700">{r.refs.map((x) => x.num).join(", ") || "Sin referencias"}</td><td><StatusBadge status={r.status} /></td><td className="r">{clp(r.total)}</td></tr>)}
          </tbody></table>
        ) : (
          <table className="tbl sticky-head" style={{ minWidth: 980 }}>
            <thead><tr><th>N° referencia</th><th>Tipo</th><th>Cliente</th><th>Facturas asociadas</th><th>Última emisión</th><th className="r">Monto facturado</th><th className="r">Saldo</th><th>Estado de pago</th></tr></thead>
            <tbody>{list.map((r) => (
              <tr key={r.tipo + r.num} className="click" onClick={() => openModal({ type: "ref", tipo: r.tipo, num: r.num })}>
                <td className="font-extrabold tabular-nums"><button type="button" className="lnk" onClick={(e) => { e.stopPropagation(); openModal({ type: "ref", tipo: r.tipo, num: r.num }); }}>{r.num}</button></td>
                <td><span className="tag tag-neutral">{r.tipo}</span></td><td className="font-semibold">{sn(cmap[r.clientId]?.name)}</td><td>{r.folios.join(", ")}</td><td>{fd(r.fecha)}</td>
                <td className="r">{clp(r.monto)}</td><td className="r font-bold">{clp(r.saldo)}</td><td><span className={`badge ${stCls(r.estado)}`}>{r.estado}</span></td>
              </tr>))}</tbody>
          </table>
        )}
        {!exige && !list.length && <p className="px-4 py-10 text-sm text-neutral-700">No hay referencias con ese número. Revisa el N° o busca en <b>OC sin factura</b>.</p>}
      </div>
    </>
  );
}

// ───────────────────────── Pagadas ─────────────────────────
export function PagadasView() {
  const { d, cmap, snap, openDrawer, rowH } = useApp();
  const [pf, setPf] = useState({ d: "", h: "", cli: "", medio: "" });
  const [limit, setLimit] = useState(150);
  const paidRows = d.rows.filter((r) => r.status === "Pagada" && r.lastPay);
  const rows = useMemo(() => paidRows.filter((r) => (!pf.d || r.lastPay!.fecha >= pf.d) && (!pf.h || r.lastPay!.fecha <= pf.h) && (!pf.cli || r.clientId === pf.cli) && (!pf.medio || r.payments.some((p) => p.medio === pf.medio))).sort((a, b) => (a.lastPay!.fecha < b.lastPay!.fecha ? 1 : -1)), [paidRows, pf]);
  const cobradoAnio = d.rows.reduce((a, r) => a + r.payments.filter((p) => p.fecha.startsWith("2026")).reduce((x, p) => x + p.monto, 0), 0);
  const pm = (i: number) => d.rows.reduce((a, r) => a + r.payments.filter((p) => p.fecha >= mStart(i) && p.fecha <= mEnd(i)).reduce((x, p) => x + p.monto, 0), 0);
  const mon = Array.from({ length: +snap.today.slice(5, 7) }, (_, i) => i);
  const medio: Record<string, number> = {};
  d.rows.forEach((r) => r.payments.forEach((p) => { if (p.fecha.startsWith("2026")) medio[p.medio] = (medio[p.medio] || 0) + p.monto; }));
  const lento: Record<string, number[]> = {};
  paidRows.forEach((r) => (lento[r.clientId] ??= []).push(diffDays(r.lastPay!.fecha, r.emision)));
  const lentos = Object.keys(lento).map((id) => ({ id, label: sn(cmap[id]?.name), value: Math.round(lento[id].reduce((a, b) => a + b, 0) / lento[id].length) })).sort((a, b) => b.value - a.value).slice(0, 10);
  const filtSum = rows.reduce((a, r) => a + r.total, 0);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + diffDays(r.lastPay!.fecha, r.emision), 0) / rows.length) : 0;
  const pal = ["#201e1d", "#ec3013", "#9b9797", "#ff9783", "#605d5d"];
  return (
    <>
      <PageHead title="Pagadas" sub={`Cobrado 2026 · ${clp(cobradoAnio)}`} actions={<button type="button" className="btn btn-secondary" onClick={() => downloadCsv("facturas_pagadas", INV_COLS, rows.map((r) => invRow(r, cmap[r.clientId])))}><Download size={16} aria-hidden />Exportar a Excel</button>} />
      <div className="mb-6 mt-4 grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,400px),1fr))" }}>
        <ChartCard title="Cobrado por mes" sub="Pagos recibidos 2026 (con IVA)" render={(t) => <Bars label="Cobrado por mes" labels={mon.map((i) => MES[i])} series={[{ name: "Cobrado", color: "#ec3013", values: mon.map(pm) }]} asTable={t} />} />
        <ChartCard title="Cobrado por medio de pago" sub="2026" render={(t) => <Donut label="Cobrado por medio de pago" items={Object.keys(medio).map((m, i) => ({ label: m, value: medio[m], color: pal[i % 5] }))} asTable={t} centerLabel="Cobrado" />} />
        <ChartCard title="Días promedio de pago por receptor" sub="10 más lentos" render={(t) => <HBars label="Días promedio de pago por receptor" items={lentos} fmt={(v) => v + " días"} valueLabel="Días" asTable={t} />} />
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="field"><label htmlFor="pf-d">Pago desde</label><input id="pf-d" type="date" className="input !w-auto" value={pf.d} onChange={(e) => setPf({ ...pf, d: e.target.value })} /></div>
        <div className="field"><label htmlFor="pf-h">Pago hasta</label><input id="pf-h" type="date" className="input !w-auto" value={pf.h} onChange={(e) => setPf({ ...pf, h: e.target.value })} /></div>
        <div className="field"><label htmlFor="pf-c">Cliente</label><select id="pf-c" className="input !w-auto max-w-[220px]" value={pf.cli} onChange={(e) => setPf({ ...pf, cli: e.target.value })}><option value="">Todos</option>{snap.clients.map((c) => <option key={c.id} value={c.id}>{sn(c.name)}</option>)}</select></div>
        <div className="field"><label htmlFor="pf-m">Medio</label><select id="pf-m" className="input !w-auto" value={pf.medio} onChange={(e) => setPf({ ...pf, medio: e.target.value })}><option value="">Todos</option>{snap.config.catalogs.medios.map((m) => <option key={m}>{m}</option>)}</select></div>
        <span className="pb-2.5 text-xs text-neutral-700">{rows.length} facturas · {clp(filtSum)} · promedio {avg} días</span>
      </div>
      <div className="scroll-x" style={{ maxHeight: "calc(100vh - 240px)", ["--row-h" as string]: rowH + "px" }}>
        <table className="tbl sticky-head" style={{ minWidth: 1000 }}>
          <thead><tr><th>Folio</th><th>Cliente</th><th>Emisión</th><th>Fecha de pago</th><th>Medio</th><th className="r">Días en pagar</th><th>Recibido por</th><th>Comprobante</th><th className="r">Total</th></tr></thead>
          <tbody>{rows.slice(0, limit).map((r) => { const dd = diffDays(r.lastPay!.fecha, r.emision); return (
            <tr key={r.folio} className="click" onClick={() => openDrawer(r.folio)}>
              <td className="font-extrabold"><button type="button" className="lnk" onClick={(e) => { e.stopPropagation(); openDrawer(r.folio); }}>{r.folio}</button></td><td className="font-semibold">{sn(cmap[r.clientId]?.name)}</td><td>{fd(r.emision)}</td><td className="font-semibold">{fd(r.lastPay!.fecha)}</td><td>{r.lastPay!.medio}</td>
              <td className="r font-semibold" style={{ color: dd > 60 ? BAD : undefined }}>{dd}</td><td>{r.lastPay!.recibidoPor}</td><td className="text-neutral-700">{r.lastPay!.comp || "—"}</td><td className="r">{clp(r.total)}</td>
            </tr>); })}</tbody>
        </table>
        {!rows.length && <Empty icon={<Search size={22} aria-hidden />} title="Sin pagos para este filtro" text="Ajusta las fechas, el cliente o el medio de pago." />}
      </div>
      {rows.length > limit && <button type="button" className="btn btn-secondary mt-3" onClick={() => setLimit(limit + 150)}>Mostrar más · quedan {rows.length - limit}</button>}
    </>
  );
}

// ───────────────────────── Por cobrar ─────────────────────────
export function PorCobrarView() {
  const { d, cmap, canEdit, openDrawer, openModal, rowH, today: T } = useApp();
  const [group, setGroup] = useState<"cli" | "list">("cli");
  const [openG, setOpenG] = useState<Record<string, boolean>>({});
  const open = d.rows.filter((r) => r.saldo > 0).sort((a, b) => (a.venc < b.venc ? -1 : 1));
  const total = open.reduce((a, r) => a + r.saldo, 0);
  const venc = open.filter((r) => r.venc < T).reduce((a, r) => a + r.saldo, 0);
  const porVencer = total - venc;
  const parcial = open.filter((r) => r.status === "Pago parcial").reduce((a, r) => a + r.saldo, 0);
  const byC = useMemo(() => {
    const m: Record<string, { id: string; rows: typeof open; tr: number[]; total: number }> = {};
    open.forEach((r) => { const x = (m[r.clientId] ??= { id: r.clientId, rows: [], tr: [0, 0, 0, 0, 0], total: 0 }); x.rows.push(r); x.tr[tramo(r)] += r.saldo; x.total += r.saldo; });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [open]);
  const agTot = [0, 1, 2, 3, 4].map((i) => byC.reduce((a, c) => a + c.tr[i], 0));
  const TRC = ["#9b9797", "#ffc4b8", "#ff9783", "#dd2b0f", "#7c1405"];
  const exportList = () => downloadCsv("facturas_por_cobrar", INV_COLS, open.map((r) => invRow(r, cmap[r.clientId])));
  const exportAging = () => downloadCsv("antiguedad_deuda", ["Cliente", ...TRAMOS, "Total"], byC.map((c) => [cmap[c.id]?.name, ...c.tr, c.total]));
  const Row = ({ r, indent }: { r: (typeof open)[number]; indent?: boolean }) => {
    const dd = diasInfo(r);
    return (
      <tr className="click" onClick={() => openDrawer(r.folio)}>
        <td className={`font-extrabold ${indent ? "!pl-11" : ""}`}><button type="button" className="lnk" onClick={(e) => { e.stopPropagation(); openDrawer(r.folio); }}>{r.folio}</button></td>
        <td className="font-semibold">{sn(cmap[r.clientId]?.name)}</td><td className="text-neutral-700">{r.sucursal || "—"}</td><td>{fd(r.venc)}</td><td className="text-xs font-semibold" style={{ color: dd.color }}>{dd.text}</td>
        <td><StatusBadge status={r.status} /></td><td className="r text-neutral-700">{clp(r.total)}</td><td className="r font-bold">{clp(r.saldo)}</td>
        <td onClick={(e) => e.stopPropagation()}>{canEdit && <div className="flex justify-end gap-1"><button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal({ type: "pago", folio: r.folio })}><Banknote size={14} aria-hidden />Pago</button>{r.status === "En cobranza" && <button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal({ type: "gestion", folio: r.folio })}><Phone size={14} aria-hidden />Gestión</button>}</div>}</td>
      </tr>
    );
  };
  return (
    <>
      <PageHead title="Por cobrar" sub="Pendiente · pago parcial · en cobranza" actions={<><Seg name="pcg" label="Agrupación" value={group} onChange={setGroup} options={[{ v: "cli", l: "Agrupado por cliente" }, { v: "list", l: "Lista plana" }]} /><button type="button" className="btn btn-secondary" onClick={exportList}><Download size={16} aria-hidden />Exportar</button></>} />
      <div className="mt-4"><KpiGrid items={[{ l: "Por cobrar total", v: clp(total), s: `${open.length} facturas con saldo` }, { l: "Vencido (en cobranza)", v: clp(venc), s: `${total ? Math.round((venc / total) * 100) : 0} % del total`, c: venc ? BAD : undefined }, { l: "Por vencer", v: clp(porVencer), s: "Dentro del plazo" }, { l: "Con pago parcial", v: clp(parcial), s: `${open.filter((r) => r.status === "Pago parcial").length} facturas` }]} /></div>
      <div className="mb-2 flex items-baseline justify-between gap-3"><h3>Antigüedad de deuda</h3><button type="button" className="btn btn-ghost text-xs" onClick={exportAging}><Download size={14} aria-hidden />Exportar tabla</button></div>
      <div className="scroll-x mb-7">
        <table className="tbl" style={{ minWidth: 860 }}>
          <thead><tr><th>Cliente</th>{TRAMOS.map((t, i) => <th key={t} className="r"><span className="mr-1.5 inline-block size-2" style={{ background: TRC[i] }} aria-hidden />{t}</th>)}<th className="r">Total</th></tr></thead>
          <tbody>{byC.map((c) => <tr key={c.id} className="click" style={{ height: rowH }} onClick={() => { setGroup("cli"); setOpenG({ ...openG, [c.id]: true }); document.getElementById("detalle")?.scrollIntoView({ behavior: "smooth" }); }}><td className="font-semibold">{sn(cmap[c.id]?.name)}</td>{c.tr.map((v, i) => <td key={i} className="r" style={{ color: v && i >= 3 ? BAD : v ? undefined : "var(--color-neutral-500)", fontWeight: v && i >= 3 ? 700 : 400 }}>{v ? clp(v) : "—"}</td>)}<td className="r font-extrabold">{clp(c.total)}</td></tr>)}</tbody>
          <tfoot><tr><td>Total</td>{agTot.map((v, i) => <td key={i} className="r">{clp(v)}</td>)}<td className="r text-accent-700">{clp(total)}</td></tr></tfoot>
        </table>
      </div>
      <h3 id="detalle" className="mb-2">Detalle</h3>
      <div className="border-t-2 border-ink" style={{ ["--row-h" as string]: rowH + "px" }}>
        {group === "cli" ? byC.map((c) => {
          const on = !!openG[c.id];
          const oldest = c.rows[0];
          const vencido = c.rows.filter((r) => r.venc < T).reduce((a, r) => a + r.saldo, 0);
          return (
            <div key={c.id} className="border-b border-divider">
              <button type="button" aria-expanded={on} onClick={() => setOpenG({ ...openG, [c.id]: !on })} className="grid w-full grid-cols-[20px_1fr_auto_auto_auto] items-center gap-4 border-0 bg-transparent px-2 py-3 text-left hover:bg-neutral-200" style={{ background: on ? "var(--color-neutral-200)" : undefined }}>
                <ChevronRight size={16} aria-hidden style={{ transform: on ? "rotate(90deg)" : undefined, transition: "transform .15s" }} />
                <span><b className="text-sm">{sn(cmap[c.id]?.name)}</b> <span className="text-xs text-neutral-700">· {c.rows.length} facturas · RUT {cmap[c.id]?.rut}</span></span>
                <span className="text-xs font-semibold" style={{ color: oldest.venc < T ? BAD : undefined }}>{diasInfo(oldest).text}</span>
                <span className="text-xs text-neutral-700 tabular-nums">vencido {clp(vencido)}</span>
                <span className="min-w-[120px] text-right text-[15px] font-extrabold tabular-nums">{clp(c.total)}</span>
              </button>
              {on && <div className="overflow-x-auto"><table className="tbl"><tbody>{c.rows.map((r) => <Row key={r.folio} r={r} indent />)}</tbody></table></div>}
            </div>
          );
        }) : (
          <div className="overflow-x-auto"><table className="tbl sticky-head" style={{ minWidth: 960 }}><thead><tr><th>Folio</th><th>Cliente</th><th>Local</th><th>Vence</th><th>Plazo</th><th>Estado</th><th className="r">Total</th><th className="r">Saldo</th><th /></tr></thead><tbody>{open.map((r) => <Row key={r.folio} r={r} />)}</tbody></table></div>
        )}
        {!open.length && <Empty title="Nada por cobrar" text="Todas las facturas están pagadas o anuladas." />}
      </div>
    </>
  );
}

