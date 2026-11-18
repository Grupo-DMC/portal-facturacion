"use client";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, CalendarArrowDown, ChevronRight, Download, Filter, Grid3x3, Keyboard, Phone, Plus, Save, Search, Send, Banknote, X } from "lucide-react";
import { useApp } from "../app-context";
import { Empty, Field, MoneyInput, PageHead, StatusBadge, Tabs } from "../ui";
import { STS, calcIva, mi } from "@/lib/domain";
import { clp, condS, digits, fd, MES, sn } from "@/lib/format";
import { INV_COLS, downloadCsv, invRow } from "@/lib/export";
import { AMB, BAD, MUTED, diasInfo } from "@/lib/view";
import type { Row, Status } from "@/lib/types";
import { bulkEnvio, bulkPay, saveSheet } from "@/server/actions";

interface Filters { estados: Status[]; cliente: string; sucursal: string; servicio: string; emD: string; emH: string; veD: string; veH: string; mMin: string; mMax: string; conOC: "all" | "con" | "sin" | "exige"; refTipo: string; q: string; envio: string }
const EF: Filters = { estados: [], cliente: "", sucursal: "", servicio: "", emD: "", emH: "", veD: "", veH: "", mMin: "", mMax: "", conOC: "all", refTipo: "", q: "", envio: "" };
type SortKey = "folio" | "emision" | "cliente" | "sucursal" | "servicio" | "neto" | "iva" | "total" | "venc" | "status" | "saldo";
const COLS: { k: SortKey | null; l: string; al?: "r"; t?: string }[] = [
  { k: "folio", l: "Folio" }, { k: "emision", l: "Emisión" }, { k: "cliente", l: "Receptor" }, { k: "sucursal", l: "Local" }, { k: "servicio", l: "Servicio" }, { k: null, l: "Cond." },
  { k: "neto", l: "Neto", al: "r" }, { k: "iva", l: "IVA", al: "r", t: "Calculado" }, { k: "total", l: "Total", al: "r" }, { k: "venc", l: "Vence" }, { k: null, l: "Días" }, { k: null, l: "Referencias" },
  { k: "status", l: "Estado" }, { k: "saldo", l: "Saldo", al: "r" }, { k: null, l: "Envío" },
];

export function FacturasView({ initialQ = "", initialVenc = "" }: { initialQ?: string; initialVenc?: string }) {
  const app = useApp();
  const { d, cmap, snap, month, canEdit, openDrawer, openModal, rowH, run, busy, today } = app;
  const [tab, setTab] = useState<"all" | number>(initialVenc ? "all" : month);
  const [f, setF] = useState<Filters>({ ...EF, q: initialQ, veD: initialVenc, veH: initialVenc });
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "folio", d: -1 });
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const [limit, setLimit] = useState(150);
  const [adv, setAdv] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [bulkDate, setBulkDate] = useState(today);
  const [viewName, setViewName] = useState("");
  const [views, setViews] = useState<{ name: string; tab: "all" | number; f: Filters }[]>([
    { name: "En cobranza · Líder", tab: "all", f: { ...EF, estados: ["En cobranza"], cliente: "walmart", sucursal: "Líder" } },
    { name: "Sin OC · mes actual", tab: month, f: { ...EF, conOC: "sin" } },
    { name: "No enviadas", tab: "all", f: { ...EF, envio: "No enviada" } },
  ]);
  useEffect(() => { try { const s = localStorage.getItem("dmc.views"); if (s) setViews(JSON.parse(s)); } catch { /* sin storage */ } }, []);
  const persistViews = (v: typeof views) => { setViews(v); try { localStorage.setItem("dmc.views", JSON.stringify(v)); } catch { /* noop */ } };
  const setFl = <K extends keyof Filters>(k: K, v: Filters[K]) => { setF((s) => ({ ...s, [k]: v })); setLimit(150); };

  const filtered = useMemo(() => {
    const q = f.q.toLowerCase().trim();
    return d.rows.filter((r) => {
      const c = cmap[r.clientId];
      if (tab !== "all" && mi(r) !== tab) return false;
      if (f.estados.length && !f.estados.includes(r.status)) return false;
      if (f.cliente && r.clientId !== f.cliente) return false;
      if (f.sucursal && !r.sucursal.toLowerCase().includes(f.sucursal.toLowerCase())) return false;
      if (f.servicio && r.servicio !== f.servicio) return false;
      if (f.emD && r.emision < f.emD) return false; if (f.emH && r.emision > f.emH) return false;
      if (f.veD && r.venc < f.veD) return false; if (f.veH && r.venc > f.veH) return false;
      if (f.mMin && r.total < +f.mMin) return false; if (f.mMax && r.total > +f.mMax) return false;
      if (f.conOC === "con" && !r.hasOC) return false; if (f.conOC === "sin" && r.hasOC) return false;
      if (f.conOC === "exige" && !(c?.exigeOC && !r.hasOC && !r.anulada)) return false;
      if (f.refTipo && !r.refs.some((x) => x.tipo === f.refTipo)) return false;
      if (f.envio && (r.envio?.estado || "No enviada") !== f.envio) return false;
      if (f.envio === "No enviada" && r.anulada) return false;
      if (q && !(String(r.folio).includes(q) || c?.name.toLowerCase().includes(q) || r.sucursal.toLowerCase().includes(q) || r.refs.some((x) => x.num.toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [d.rows, cmap, f, tab]);

  const sorted = useMemo(() => {
    const val = (r: Row): string | number => (sort.k === "cliente" ? cmap[r.clientId]?.name ?? "" : sort.k === "status" ? STS.indexOf(r.status) : (r[sort.k] as string | number));
    return filtered.slice().sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.d || b.folio - a.folio; });
  }, [filtered, sort, cmap]);

  const act = filtered.filter((r) => !r.anulada);
  const tNeto = act.reduce((a, r) => a + r.neto, 0), tIva = act.reduce((a, r) => a + r.iva, 0), tTotal = act.reduce((a, r) => a + r.total, 0), tSaldo = act.reduce((a, r) => a + r.saldo, 0);
  const shown = sorted.slice(0, limit);
  const selN = Object.keys(sel).filter((k) => sel[+k]).length;
  const tabCount = (m: "all" | number) => d.rows.filter((r) => m === "all" || mi(r) === m).length;
  const months = Array.from({ length: Math.min(12, +today.slice(5, 7)) }, (_, i) => i);
  const chips: { l: string; rm: () => void }[] = [];
  f.estados.forEach((s) => chips.push({ l: s, rm: () => setFl("estados", f.estados.filter((x) => x !== s)) }));
  if (f.cliente) chips.push({ l: sn(cmap[f.cliente]?.name), rm: () => setFl("cliente", "") });
  if (f.servicio) chips.push({ l: f.servicio, rm: () => setFl("servicio", "") });
  if (f.sucursal) chips.push({ l: `Local: ${f.sucursal}`, rm: () => setFl("sucursal", "") });
  if (f.emD || f.emH) chips.push({ l: `Emisión ${fd(f.emD)} → ${fd(f.emH)}`, rm: () => setF((s) => ({ ...s, emD: "", emH: "" })) });
  if (f.veD || f.veH) chips.push({ l: `Vence ${fd(f.veD)} → ${fd(f.veH)}`, rm: () => setF((s) => ({ ...s, veD: "", veH: "" })) });
  if (f.mMin || f.mMax) chips.push({ l: `Total ${f.mMin ? clp(+f.mMin) : "—"} → ${f.mMax ? clp(+f.mMax) : "—"}`, rm: () => setF((s) => ({ ...s, mMin: "", mMax: "" })) });
  if (f.conOC !== "all") chips.push({ l: ({ con: "Con OC", sin: "Sin OC", exige: "Sin OC (cliente la exige)" } as Record<string, string>)[f.conOC], rm: () => setFl("conOC", "all") });
  if (f.refTipo) chips.push({ l: `Ref: ${f.refTipo}`, rm: () => setFl("refTipo", "") });
  if (f.envio) chips.push({ l: f.envio, rm: () => setFl("envio", "") });
  const clear = () => { setF({ ...EF }); setLimit(150); };

  const exportCsv = (rows: Row[], name: string) => downloadCsv(name, INV_COLS, rows.map((r) => invRow(r, cmap[r.clientId])));
  const allChecked = shown.length > 0 && shown.every((r) => sel[r.folio]);

  // ─── modo planilla ───
  interface SRow { k: number; folio: string; emision: string; clienteQ: string; clientId: string; sucursal: string; servicio: string; neto: number | null; cond: string; cot: string; oc: string }
  const [rowsS, setRowsS] = useState<SRow[]>([]);
  const nextF = (rs: SRow[]) => Math.max(...snap.invoices.map((i) => i.folio), ...rs.map((r) => +r.folio || 0)) + 1;
  const newS = (rs: SRow[]): SRow => ({ k: Math.random(), folio: String(nextF(rs)), emision: rs[rs.length - 1]?.emision ?? today, clienteQ: "", clientId: "", sucursal: "", servicio: snap.config.catalogs.services[0], neto: null, cond: "30", cot: "", oc: "" });
  const openSheet = () => { setSheet(true); setRowsS([newS([])]); };
  const setS = (i: number, p: Partial<SRow>) => setRowsS((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const onClienteQ = (i: number, v: string) => {
    const lv = v.toLowerCase(), n = v.replace(/[^0-9kK]/g, "").toUpperCase();
    const c = snap.clients.find((c) => c.name.toLowerCase() === lv || sn(c.name).toLowerCase() === lv || (n.length >= 8 && c.rut.replace(/[.\-]/g, "").toUpperCase() === n));
    setS(i, c ? { clienteQ: c.name, clientId: c.id, cond: String(c.cond), sucursal: rowsS[i].sucursal || c.branches[0] || "" } : { clienteQ: v, clientId: "" });
  };
  const keyS = (i: number) => (e: React.KeyboardEvent) => { if (e.key === "Enter" && i === rowsS.length - 1) { e.preventDefault(); setRowsS((rs) => [...rs, newS(rs)]); setTimeout(() => { const els = document.querySelectorAll<HTMLInputElement>("[data-sheet-first]"); els[els.length - 1]?.focus(); }, 30); } };
  const saveS = async () => {
    const rows = rowsS.filter((r) => r.folio || r.clientId || r.neto).map((r) => ({ folio: +digits(r.folio), emision: r.emision, clientId: r.clientId, sucursal: r.sucursal, servicio: r.servicio, neto: r.neto, cond: +r.cond, cot: r.cot.trim(), oc: r.oc.trim() }));
    if (!rows.length) return;
    const res = await run(saveSheet({ rows }));
    if (res.ok) { setSheet(false); setRowsS([]); }
  };

  return (
    <>
      <PageHead title="Facturas" rule={false} sub="Libro de facturación 2026 · cada folio es el N° emitido en el portal del SII"
        actions={<>
          {canEdit && <button type="button" className="btn btn-secondary" onClick={() => (sheet ? setSheet(false) : openSheet())}><Grid3x3 size={16} aria-hidden />{sheet ? "Cerrar modo planilla" : "Modo planilla"}</button>}
          <button type="button" className="btn btn-secondary" onClick={() => exportCsv(sorted, "libro_facturas")}><Download size={16} aria-hidden />Exportar a Excel</button>
          {canEdit && <button type="button" className="btn btn-primary" onClick={() => openModal({ type: "factura", init: { mode: "new" } })}><Plus size={16} aria-hidden />Nueva factura <span className="kbd">N</span></button>}
        </>} />
      <Tabs label="Mes del libro" value={tab} onChange={(v) => { setTab(v); setLimit(150); }} tabs={[...months.map((m) => ({ v: m as "all" | number, l: MES[m], n: tabCount(m) })), { v: "all" as const, l: "Todo 2026", n: tabCount("all") }]} />

      <div className="flex flex-wrap items-center gap-2 py-3">
        <div className="relative w-60"><Search size={16} className="pointer-events-none absolute left-2.5 top-2.5 text-neutral-700" aria-hidden /><input className="input !pl-[34px]" aria-label="Buscar en el libro" value={f.q} onChange={(e) => setFl("q", e.target.value)} placeholder="Folio, receptor, local, OC…" /></div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
          {STS.map((s) => { const on = f.estados.includes(s); return <button key={s} type="button" aria-pressed={on} onClick={() => setFl("estados", on ? f.estados.filter((x) => x !== s) : [...f.estados, s])} className="border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: on ? "var(--color-ink)" : "var(--color-divider)", background: on ? "var(--color-ink)" : "transparent", color: on ? "var(--color-bg)" : undefined }}>{s}</button>; })}
        </div>
        <select className="input !w-auto max-w-[200px]" aria-label="Receptor" value={f.cliente} onChange={(e) => setFl("cliente", e.target.value)}><option value="">Todos los receptores</option>{snap.clients.map((c) => <option key={c.id} value={c.id}>{sn(c.name)}</option>)}</select>
        <select className="input !w-auto" aria-label="Servicio" value={f.servicio} onChange={(e) => setFl("servicio", e.target.value)}><option value="">Todo servicio</option>{snap.config.catalogs.services.map((s) => <option key={s}>{s}</option>)}</select>
        <button type="button" className="btn btn-secondary" aria-expanded={adv} onClick={() => setAdv(!adv)}><Filter size={16} aria-hidden />Filtros avanzados</button>
        <select className="input !w-auto" aria-label="Vistas guardadas" value="" onChange={(e) => { const v = views.find((x) => x.name === e.target.value); if (v) { setTab(v.tab); setF({ ...v.f }); setLimit(150); } }}><option value="">Vistas guardadas</option>{views.map((v) => <option key={v.name}>{v.name}</option>)}</select>
      </div>

      {adv && (
        <div className="mb-3 grid gap-x-4 gap-y-3 border-t-2 border-ink bg-surface p-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
          <Field label="Local (contiene)"><input className="input" list="dl-suc" value={f.sucursal} placeholder="Ej. Líder" onChange={(e) => setFl("sucursal", e.target.value)} /><datalist id="dl-suc">{[...new Set(snap.clients.flatMap((c) => c.branches))].map((b) => <option key={b} value={b} />)}</datalist></Field>
          <Field label="Emisión desde"><input type="date" className="input" value={f.emD} onChange={(e) => setFl("emD", e.target.value)} /></Field>
          <Field label="Emisión hasta"><input type="date" className="input" value={f.emH} onChange={(e) => setFl("emH", e.target.value)} /></Field>
          <Field label="Vencimiento desde"><input type="date" className="input" value={f.veD} onChange={(e) => setFl("veD", e.target.value)} /></Field>
          <Field label="Vencimiento hasta"><input type="date" className="input" value={f.veH} onChange={(e) => setFl("veH", e.target.value)} /></Field>
          <Field label="Total mínimo"><MoneyInput value={f.mMin ? +f.mMin : null} placeholder="$ 0" onChange={(n) => setFl("mMin", n ? String(n) : "")} /></Field>
          <Field label="Total máximo"><MoneyInput value={f.mMax ? +f.mMax : null} placeholder="Sin tope" onChange={(n) => setFl("mMax", n ? String(n) : "")} /></Field>
          <Field label="Orden de compra"><select className="input" value={f.conOC} onChange={(e) => setFl("conOC", e.target.value as Filters["conOC"])}><option value="all">Todas</option><option value="con">Con OC</option><option value="sin">Sin OC</option><option value="exige">Sin OC (cliente la exige)</option></select></Field>
          <Field label="Tipo de referencia"><select className="input" value={f.refTipo} onChange={(e) => setFl("refTipo", e.target.value)}><option value="">Todas</option><option>Cotización DMC</option><option>OC cliente</option><option>HEP</option></select></Field>
          <Field label="Envío al cliente"><select className="input" value={f.envio} onChange={(e) => setFl("envio", e.target.value)}><option value="">Todos</option><option>Enviada</option><option>No enviada</option></select></Field>
          <Field label="Guardar como vista"><div className="flex gap-1.5"><input className="input" value={viewName} maxLength={40} placeholder="Nombre de la vista" onChange={(e) => setViewName(e.target.value)} /><button type="button" className="btn btn-secondary btn-icon shrink-0" aria-label="Guardar vista" onClick={() => { const n = viewName.trim(); if (!n) return; persistViews([...views.filter((v) => v.name !== n), { name: n, tab, f: { ...f } }]); setViewName(""); app.toast(`Vista “${n}” guardada`); }}><Bookmark size={16} aria-hidden /></button></div></Field>
        </div>
      )}
      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-neutral-700">Filtros activos</span>
          {chips.map((c, i) => <button key={i} type="button" onClick={c.rm} className="inline-flex items-center gap-1.5 border-0 bg-ink py-[3px] pl-2.5 pr-1.5 text-xs text-bg" aria-label={`Quitar filtro ${c.l}`}>{c.l}<X size={14} aria-hidden /></button>)}
          <button type="button" className="btn btn-ghost text-xs" onClick={clear}>Limpiar todo</button>
        </div>
      )}

      {sheet && canEdit && (
        <div className="mb-4 border-2 border-accent bg-bg">
          <div className="flex flex-wrap items-center gap-3 border-b border-accent-300 bg-accent-100 px-3 py-2.5">
            <span className="text-sm font-extrabold">Modo planilla</span>
            <span className="min-w-60 flex-1 text-xs text-accent-800">Solo escribes el neto: IVA y total se calculan y quedan bloqueados · Tab avanza · Enter agrega fila · folio = N° emitido en el SII</span>
            <button type="button" className="btn btn-secondary" onClick={() => setSheet(false)}>Descartar</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={saveS}><Save size={16} aria-hidden />Guardar {rowsS.filter((r) => r.folio || r.clientId || r.neto).length} facturas</button>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl" style={{ minWidth: 1320 }}>
              <thead><tr><th>#</th><th>Folio SII</th><th>Emisión</th><th>Receptor (RUT o razón social)</th><th>Local</th><th>Servicio</th><th className="r">Neto</th><th className="r" title="Calculado automáticamente">IVA (auto)</th><th className="r" title="Calculado automáticamente">Total (auto)</th><th>Condición</th><th>Cotización</th><th>OC</th><th><span className="sr-only">Quitar</span></th></tr></thead>
              <tbody>
                {rowsS.map((r, i) => {
                  const c = r.clientId ? cmap[r.clientId] : null;
                  const missingOC = c?.exigeOC && !r.oc.trim();
                  const cell = "h-9 w-full border-0 bg-transparent px-2 font-[inherit]";
                  return (
                    <tr key={r.k} style={{ height: 38 }}>
                      <td className="text-neutral-700 tabular-nums">{i + 1}</td>
                      <td><input data-sheet-first="1" aria-label="Folio" className={`${cell} font-bold tabular-nums`} style={{ background: r.folio && snap.invoices.some((x) => x.folio === +r.folio) ? "var(--color-accent-200)" : undefined }} value={r.folio} inputMode="numeric" onChange={(e) => setS(i, { folio: digits(e.target.value) })} onKeyDown={keyS(i)} /></td>
                      <td><input type="date" aria-label="Emisión" className={cell} value={r.emision} max={today} onChange={(e) => setS(i, { emision: e.target.value })} onKeyDown={keyS(i)} /></td>
                      <td><input list="dl-cli" aria-label="Receptor" className={cell} style={{ background: r.clienteQ && !r.clientId ? "var(--color-accent-100)" : undefined }} value={r.clienteQ} placeholder="76.042.014-6 o Walmart…" onChange={(e) => onClienteQ(i, e.target.value)} onKeyDown={keyS(i)} /></td>
                      <td><input list="dl-all-suc" aria-label="Local" className={cell} value={r.sucursal} onChange={(e) => setS(i, { sucursal: e.target.value })} onKeyDown={keyS(i)} /></td>
                      <td><select aria-label="Servicio" className={cell} value={r.servicio} onChange={(e) => setS(i, { servicio: e.target.value })}>{snap.config.catalogs.services.map((s) => <option key={s}>{s}</option>)}</select></td>
                      <td><MoneyInput aria-label="Neto" value={r.neto} className="!min-h-9 !border-0 !bg-transparent" placeholder="$ 0" onChange={(n) => setS(i, { neto: n })} onKeyDown={keyS(i)} /></td>
                      <td className="r bg-neutral-200 text-neutral-700">{clp(calcIva(r.neto || 0))}</td>
                      <td className="r bg-neutral-200 font-bold">{clp((r.neto || 0) + calcIva(r.neto || 0))}</td>
                      <td><select aria-label="Condición" className={cell} value={r.cond} onChange={(e) => setS(i, { cond: e.target.value })}>{snap.config.catalogs.conds.map((x) => <option key={x} value={x}>{x === 0 ? "Contado" : `${x} días`}</option>)}</select></td>
                      <td><input aria-label="Cotización" className={cell} value={r.cot} placeholder="COT-…" onChange={(e) => setS(i, { cot: e.target.value })} onKeyDown={keyS(i)} /></td>
                      <td><input aria-label="OC" className={cell} style={{ background: missingOC ? "var(--color-warn-bg)" : undefined }} value={r.oc} placeholder={c?.exigeOC ? "OC exigida" : ""} onChange={(e) => setS(i, { oc: e.target.value })} onKeyDown={keyS(i)} /></td>
                      <td><button type="button" className="btn btn-icon !size-8 text-neutral-700" aria-label={`Quitar fila ${i + 1}`} onClick={() => setRowsS((rs) => rs.filter((_, j) => j !== i))}><X size={14} aria-hidden /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <datalist id="dl-cli">{snap.clients.map((c) => <option key={c.id} value={c.name}>{c.rut}</option>)}</datalist>
            <datalist id="dl-all-suc">{snap.clients.flatMap((c) => c.branches.map((b) => <option key={b} value={b}>{sn(c.name)}</option>))}</datalist>
          </div>
          <button type="button" className="btn btn-ghost m-1.5" onClick={() => setRowsS((rs) => [...rs, newS(rs)])}><Plus size={16} aria-hidden />Agregar fila (Enter)</button>
        </div>
      )}

      {selN > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2.5 bg-ink px-3 py-2.5 text-bg" role="region" aria-label="Acciones sobre la selección">
          <span className="text-sm font-extrabold">{selN} seleccionadas</span><span className="h-6 w-0.5 bg-white/25" aria-hidden />
          {canEdit && (<>
            <span className="flex items-center gap-1.5 text-[13px]">Marcar pagadas el <input type="date" aria-label="Fecha de pago masivo" className="input !min-h-8 !w-auto !bg-bg !py-0.5" value={bulkDate} max={today} onChange={(e) => setBulkDate(e.target.value)} />
              <button type="button" className="btn btn-primary !py-1.5" disabled={busy} onClick={async () => { const r = await run(bulkPay({ folios: Object.keys(sel).filter((k) => sel[+k]).map(Number), fecha: bulkDate })); if (r.ok) setSel({}); }}>Aplicar</button></span>
            <button type="button" className="btn btn-dark" disabled={busy} onClick={async () => { const r = await run(bulkEnvio({ folios: Object.keys(sel).filter((k) => sel[+k]).map(Number) })); if (r.ok) setSel({}); }}><Send size={16} aria-hidden />Marcar enviadas</button>
          </>)}
          <button type="button" className="btn btn-dark" onClick={() => exportCsv(d.rows.filter((r) => sel[r.folio]), "facturas_seleccionadas")}><Download size={16} aria-hidden />Exportar seleccionadas</button>
          <span className="flex-1" /><button type="button" className="btn text-bg hover:!bg-white/10" onClick={() => setSel({})}>Deseleccionar</button>
        </div>
      )}

      <div className="relative min-h-80 overflow-auto border-y-2 border-ink" style={{ maxHeight: "calc(100vh - 290px)", ["--row-h" as string]: rowH + "px" }}>
        <table className="tbl sticky-head" style={{ minWidth: 1560 }}>
          <thead>
            <tr>
              <th className="!w-[34px]"><input type="checkbox" aria-label="Seleccionar todas las filas visibles" className="size-[15px]" checked={allChecked} onChange={() => setSel(allChecked ? {} : Object.fromEntries(shown.map((r) => [r.folio, true])))} /></th>
              {COLS.map((c) => (
                <th key={c.l} className={c.al === "r" ? "r" : ""} title={c.t} aria-sort={c.k && sort.k === c.k ? (sort.d === 1 ? "ascending" : "descending") : undefined}>
                  {c.k ? <button type="button" className="border-0 bg-transparent p-0 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: sort.k === c.k ? "var(--color-ink)" : undefined }} onClick={() => setSort((s) => ({ k: c.k!, d: s.k === c.k ? (s.d === 1 ? -1 : 1) : c.k === "cliente" || c.k === "sucursal" || c.k === "servicio" ? 1 : -1 }))}>{c.l}{sort.k === c.k ? (sort.d === 1 ? " ▲" : " ▼") : ""}</button> : c.l}
                </th>
              ))}
              <th><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const c = cmap[r.clientId];
              const cot = r.refs.find((x) => x.tipo === "Cotización DMC"), oc = r.refs.filter((x) => x.tipo === "OC cliente"), hep = r.refs.filter((x) => x.tipo === "HEP");
              const exige = c?.exigeOC && !oc.length && !r.anulada;
              const moved = !!(r.vencRaw && r.vencRaw !== r.venc);
              const env = r.envio?.estado === "Enviada";
              const dias = diasInfo(r);
              const owner = r.localOwner ? cmap[r.localOwner] : null;
              const checked = !!sel[r.folio];
              return (
                <tr key={r.folio} className={`click ${checked ? "sel" : ""}`} style={{ background: app.drawer === r.folio ? "var(--color-accent-100)" : undefined }} onClick={() => openDrawer(r.folio)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" className="size-[15px]" aria-label={`Seleccionar folio ${r.folio}`} checked={checked} onChange={() => setSel((s) => { const x = { ...s }; if (x[r.folio]) delete x[r.folio]; else x[r.folio] = true; return x; })} /></td>
                  <td>
                    <div className="flex flex-col leading-tight">
                      <button type="button" className="lnk" onClick={(e) => { e.stopPropagation(); openDrawer(r.folio); }} aria-label={`Abrir factura ${r.folio}`}>{r.folio}</button>
                      {r.plan && <button type="button" className="border-0 bg-transparent p-0 text-left text-[10px] font-bold text-accent-700" onClick={(e) => { e.stopPropagation(); openModal({ type: "plan", id: r.plan!.id }); }}>Cuota {r.plan.n}/{r.plan.of}</button>}
                    </div>
                  </td>
                  <td>{fd(r.emision)}</td>
                  <td className="max-w-[180px] truncate font-semibold" title={c?.name}>{sn(c?.name)}</td>
                  <td className="max-w-[170px] truncate" title={owner ? `Local de ${sn(owner.name)} · la guía puede estar a nombre de otro cliente` : r.sucursal} style={{ color: owner ? AMB : MUTED }}>{r.sucursal || "—"}</td>
                  <td>{r.servicio}</td>
                  <td>{r.cond === 0 ? <span className="tag tag-outline !px-1.5 !py-0.5">Contado</span> : <span className="text-xs text-neutral-700">{condS(r.cond)}</span>}</td>
                  <td className="r">{r.anulada ? "$ 0" : clp(r.neto)}</td>
                  <td className="r text-neutral-700">{r.anulada ? "$ 0" : clp(r.iva)}</td>
                  <td className="r">{r.anulada ? "$ 0" : clp(r.total)}</td>
                  <td title={moved ? "Vencimiento corrido a día hábil" : undefined}><span className="inline-flex items-center gap-1">{fd(r.venc)}{moved && <CalendarArrowDown size={14} className="text-accent-700" aria-label="corrido a día hábil" />}</span></td>
                  <td className="text-xs font-semibold" style={{ color: dias.color }}>{dias.text}</td>
                  <td className="text-xs"><span className="inline-flex items-baseline gap-1.5"><span className="text-neutral-700">{cot ? cot.num : "Sin COT"}</span><span style={{ color: exige ? BAD : undefined, fontWeight: exige ? 700 : 500 }}>{oc.length ? `OC ${oc[0].num}` : exige ? "Sin OC (exigida)" : ""}</span><span className="text-[11px] text-neutral-700">{(oc.length > 1 ? `+${oc.length - 1} OC ` : "") + (hep.length ? "· HEP" : "")}</span></span></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="r" style={{ fontWeight: r.saldo > 0 ? 700 : 400 }}>{r.saldo > 0 ? clp(r.saldo) : "—"}</td>
                  <td><span className="inline-flex items-center gap-1.5 text-xs" title={env ? `${fd(r.envio.fecha)} · ${r.envio.canal}` : ""} style={{ color: env ? MUTED : undefined }}><span style={{ width: 7, height: 7, background: env ? "var(--color-good-mark)" : r.anulada ? "transparent" : "var(--color-accent)" }} aria-hidden />{r.anulada ? "—" : env ? "Enviada" : "No enviada"}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-0.5">
                      {r.saldo > 0 && canEdit && <button type="button" className="btn btn-icon !size-[30px]" title="Registrar pago" aria-label={`Registrar pago folio ${r.folio}`} onClick={() => openModal({ type: "pago", folio: r.folio })}><Banknote size={14} aria-hidden /></button>}
                      {!env && !r.anulada && canEdit && <button type="button" className="btn btn-icon !size-[30px]" title="Preparar envío" aria-label={`Preparar envío folio ${r.folio}`} onClick={() => openModal({ type: "envio", folio: r.folio })}><Send size={14} aria-hidden /></button>}
                      {r.status === "En cobranza" && canEdit && <button type="button" className="btn btn-icon !size-[30px]" title="Registrar gestión de cobranza" aria-label={`Registrar gestión folio ${r.folio}`} onClick={() => openModal({ type: "gestion", folio: r.folio })}><Phone size={14} aria-hidden /></button>}
                      <button type="button" className="btn btn-icon !size-[30px]" title="Ver detalle" aria-label={`Ver detalle folio ${r.folio}`} onClick={() => openDrawer(r.folio)}><ChevronRight size={14} aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>Totales · {filtered.length} facturas <span className="text-xs font-normal text-neutral-700">(anuladas no suman)</span></td>
              <td className="r">{clp(tNeto)}</td><td className="r">{clp(tIva)}</td><td className="r">{clp(tTotal)}</td><td colSpan={4} /><td className="r text-accent-700">{clp(tSaldo)}</td><td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        {!filtered.length && <Empty icon={<Search size={22} aria-hidden />} title="Sin facturas para estos filtros" text="Prueba con otro mes, quita algún filtro o busca por folio en el buscador global."><button type="button" className="btn btn-secondary" onClick={clear}>Limpiar filtros</button></Empty>}
      </div>
      {sorted.length > limit && <button type="button" className="btn btn-secondary mt-3" onClick={() => setLimit(limit + 150)}>Mostrar 150 más · quedan {sorted.length - limit}</button>}
      <p className="mt-3.5 flex flex-wrap items-center gap-4 text-xs text-neutral-700"><Keyboard size={14} aria-hidden /><span><b>N</b> nueva factura</span><span><b>/</b> buscar</span><span><b>P</b> registrar pago en la factura abierta</span><span><b>Esc</b> cerrar</span><span className="inline-flex items-center gap-1"><CalendarArrowDown size={14} className="text-accent-700" aria-hidden />vencimiento corrido a día hábil</span></p>
    </>
  );
}
