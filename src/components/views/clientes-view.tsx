"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, FileText, MapPin, Plus, Search } from "lucide-react";
import { useApp } from "../app-context";
import { Bars, ChartCard } from "../charts";
import { ClienteModal } from "../cliente-modal";
import { KpiGrid, PageHead, Seg, StatusBadge, Tabs } from "../ui";
import { diffDays, mi, rutClean } from "@/lib/domain";
import { clp, condL, condS, fd, MES, sn } from "@/lib/format";
import { BAD, diasInfo } from "@/lib/view";
import { addContact, homologarClient, setClientRule, setContactFlag } from "@/server/actions";

type Origin = "all" | "core" | "local";
const badge = (o: string) => (o === "core" ? { bg: "var(--color-neutral-200)", fg: "var(--color-neutral-800)", l: "BD core" } : { bg: "var(--color-warn-bg)", fg: "var(--color-warn)", l: "Por validar" });

export function ClientesView() {
  const { snap, d, canEdit, rowH } = useApp();
  const [q, setQ] = useState("");
  const [o, setO] = useState<Origin>("all");
  const [nuevo, setNuevo] = useState(false);
  const stats = useMemo(() => {
    const m: Record<string, { fact: number; deuda: number; dias: number[]; venc: number }> = {};
    d.rows.forEach((r) => {
      const x = (m[r.clientId] ??= { fact: 0, deuda: 0, dias: [], venc: 0 });
      if (!r.anulada && r.emision.startsWith("2026")) x.fact += r.neto;
      x.deuda += r.saldo; if (r.status === "En cobranza") x.venc += r.saldo;
      if (r.status === "Pagada" && r.lastPay) x.dias.push(diffDays(r.lastPay.fecha, r.emision));
    });
    return m;
  }, [d.rows]);
  const rows = snap.clients.filter((c) => (o === "all" || c.origin === o) && (!q.trim() || c.name.toLowerCase().includes(q.toLowerCase()) || (rutClean(q).length >= 4 && c.rut.replace(/[.\-]/g, "").toUpperCase().includes(rutClean(q))))).sort((a, b) => (stats[b.id]?.fact ?? 0) - (stats[a.id]?.fact ?? 0));
  return (
    <>
      <PageHead title="Clientes" sub="BD core DMC Clientes + creados en Facturación" actions={canEdit && <button type="button" className="btn btn-primary" onClick={() => setNuevo(true)}><Plus size={16} aria-hidden />Cliente nuevo</button>} />
      <div className="flex flex-wrap items-center gap-2 py-3">
        <div className="relative w-[280px]"><Search size={16} className="pointer-events-none absolute left-2.5 top-2.5 text-neutral-700" aria-hidden /><input className="input !pl-[34px]" aria-label="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Razón social o RUT" /></div>
        <Seg name="corig" label="Origen" value={o} onChange={setO} options={[{ v: "all", l: "Todos" }, { v: "core", l: "BD core" }, { v: "local", l: "Por validar" }]} />
        <span className="text-xs text-neutral-700">{rows.length} clientes</span>
      </div>
      <div className="scroll-x" style={{ ["--row-h" as string]: rowH + "px" }}>
        <table className="tbl" style={{ minWidth: 1040 }}>
          <thead><tr><th>Razón social</th><th>RUT</th><th>Origen</th><th>Sucursales</th><th>Condición</th><th>Reglas</th><th className="r">Facturado 2026</th><th className="r">Deuda actual</th><th className="r">Días prom. pago</th></tr></thead>
          <tbody>{rows.map((c) => { const s = stats[c.id], b = badge(c.origin); const rules = [c.exigeOC && "Exige OC", c.unaOC && "1 OC", c.hep && "HEP"].filter(Boolean).join(" · "); return (
            <tr key={c.id} className="click">
              <td className="font-bold"><Link href={`/clientes/${c.id}`} className="text-ink no-underline hover:text-accent-700 hover:underline">{c.name}</Link></td><td>{c.rut}</td><td><span className="badge" style={{ background: b.bg, color: b.fg }}>{b.l}</span></td>
              <td>{c.branches.length}</td><td>{condL(c.cond)}</td><td className="text-xs text-neutral-700">{rules || "—"}</td><td className="r">{clp(s?.fact)}</td>
              <td className="r font-bold" style={{ color: s?.venc ? BAD : undefined }}>{s?.deuda ? clp(s.deuda) : "—"}</td><td className="r">{s?.dias.length ? Math.round(s.dias.reduce((a, b) => a + b, 0) / s.dias.length) : "—"}</td>
            </tr>); })}</tbody>
        </table>
        {!rows.length && <p className="px-2 py-10 text-sm text-neutral-700">No hay clientes con ese criterio.</p>}
      </div>
      {nuevo && <ClienteModal onClose={() => setNuevo(false)} />}
    </>
  );
}

export function FichaView({ id }: { id: string }) {
  const { snap, d, cmap, run, canEdit, openDrawer, openModal, rowH, today: T } = useApp();
  const c = cmap[id];
  const [tab, setTab] = useState<"facturas" | "pagos" | "gestiones" | "refs">("facturas");
  const [ct, setCt] = useState({ nombre: "", cargo: "", email: "", tel: "" });
  const [ctErr, setCtErr] = useState("");
  const rows = useMemo(() => d.rows.filter((r) => r.clientId === id).sort((a, b) => b.folio - a.folio), [d.rows, id]);
  if (!c) return <div className="py-16"><h1>Cliente no encontrado</h1><Link href="/clientes" className="btn btn-secondary mt-4">Volver a clientes</Link></div>;
  const act = rows.filter((r) => !r.anulada);
  const fact = act.filter((r) => r.emision.startsWith("2026")).reduce((a, r) => a + r.neto, 0);
  const deuda = rows.reduce((a, r) => a + r.saldo, 0), venc = rows.filter((r) => r.status === "En cobranza").reduce((a, r) => a + r.saldo, 0);
  const dias = rows.filter((r) => r.status === "Pagada" && r.lastPay).map((r) => diffDays(r.lastPay!.fecha, r.emision));
  const pays = rows.flatMap((r) => r.payments.map((p) => ({ p, r }))).sort((a, b) => (a.p.fecha < b.p.fecha ? 1 : -1));
  const gests = rows.flatMap((r) => r.gestiones.map((g) => ({ g, r }))).sort((a, b) => ((a.g.fecha + a.g.hora) < (b.g.fecha + b.g.hora) ? 1 : -1));
  const refs = new Map<string, { tipo: string; num: string; folios: number[]; monto: number; saldo: number }>();
  rows.forEach((r) => r.refs.forEach((x) => { const k = x.tipo + x.num; const e = refs.get(k) ?? { tipo: x.tipo, num: x.num, folios: [], monto: 0, saldo: 0 }; e.folios.push(r.folio); if (!r.anulada) { e.monto += r.total; e.saldo += r.saldo; } refs.set(k, e); }));
  const b = badge(c.origin);
  const byM = Array.from({ length: +T.slice(5, 7) }, (_, i) => act.filter((r) => mi(r) === i).reduce((a, r) => a + r.neto, 0));
  const rule = (k: "exigeOC" | "unaOC" | "hep", l: string, dsc: string) => (
    <label key={k} className="flex items-center gap-2.5 py-3.5" style={{ cursor: canEdit ? "pointer" : "default" }}>
      <input type="checkbox" className="size-[18px]" checked={c[k]} disabled={!canEdit} onChange={(e) => run(setClientRule({ clientId: id, rule: k, value: e.target.checked }))} />
      <span><span className="block text-sm font-extrabold">{l}</span><span className="block text-xs text-neutral-700">{dsc}</span></span>
    </label>
  );
  const addCt = async () => {
    if (!ct.nombre.trim()) return setCtErr("Escribe el nombre del contacto");
    const r = await run(addContact({ clientId: id, ...ct }));
    if (r.ok) { setCt({ nombre: "", cargo: "", email: "", tel: "" }); setCtErr(""); } else setCtErr(r.fieldErrors ? Object.values(r.fieldErrors)[0] : "");
  };
  return (
    <>
      <Link href="/clientes" className="btn btn-ghost mb-2 !pl-0"><ArrowLeft size={14} aria-hidden />Clientes</Link>
      <PageHead title={c.name} sub={<span className="inline-flex flex-wrap items-center gap-2.5">RUT {c.rut} · {c.giro}<span className="badge" style={{ background: b.bg, color: b.fg }}>{b.l}</span></span>} actions={<>
        {canEdit && c.origin === "local" && <button type="button" className="btn btn-secondary" onClick={() => run(homologarClient({ clientId: id }))}><Check size={14} aria-hidden />Homologar con core</button>}
        <button type="button" className="btn btn-ghost" onClick={() => openModal({ type: "edo", clientId: id })}><FileText size={14} aria-hidden />Estado de cuenta</button>
        {canEdit && <button type="button" className="btn btn-primary" onClick={() => openModal({ type: "factura", init: { mode: "new", clientId: id } })}><Plus size={16} aria-hidden />Nueva factura</button>}
      </>} />
      <div className="flex flex-wrap gap-x-8 border-b-2 border-divider">
        {rule("exigeOC", "Exige OC", "Alerta al facturar sin orden de compra")}{rule("unaOC", "Una sola OC por factura", "No permite agregar más de una OC")}{rule("hep", "Requiere HEP", "Agrega el campo HEP (portal Walmart)")}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
        {[{ l: "Facturado 2026", v: clp(fact), s: `${act.filter((r) => r.emision.startsWith("2026")).length} facturas` }, { l: "Deuda actual", v: clp(deuda), s: `${rows.filter((r) => r.saldo > 0).length} facturas con saldo`, c: venc ? BAD : undefined }, { l: "En cobranza", v: clp(venc), s: `${rows.filter((r) => r.status === "En cobranza").length} facturas` }, { l: "Días promedio de pago", v: dias.length ? Math.round(dias.reduce((a, x) => a + x, 0) / dias.length) + " días" : "—", s: `${dias.length} facturas pagadas` }].map((k) => (
          <div key={k.l} className="cell p-4"><div className="kpi-label">{k.l}</div><div className="text-2xl font-extrabold tabular-nums" style={{ color: k.c }}>{k.v}</div><div className="text-xs text-neutral-700">{k.s}</div></div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))" }}>
        <div className="cell grid grid-cols-2 content-start gap-x-4 gap-y-3.5 p-5 text-[13px]">
          <div className="col-span-full"><div className="text-[11px] text-neutral-700">Dirección</div><div className="font-semibold">{c.address}</div></div>
          <div><div className="text-[11px] text-neutral-700">Condición habitual</div><div className="font-semibold">{condL(c.cond)}</div></div>
          <div><div className="text-[11px] text-neutral-700">Encargado de pagos</div><div className="font-semibold">{c.contacts.find((x) => x.pagos)?.nombre ?? c.contact.name}</div></div>
          <div className="col-span-full"><div className="mb-1 text-[11px] text-neutral-700">Sucursales / locales ({c.branches.length})</div><div className="flex flex-wrap gap-1">{c.branches.map((x) => <span key={x} className="tag tag-neutral"><MapPin size={14} aria-hidden />{x}</span>)}{!c.branches.length && <span className="text-neutral-700">Sin locales registrados</span>}</div></div>
        </div>
        <ChartCard title="Facturación mensual" sub="Neto 2026" render={(t) => <Bars label={`Facturación mensual de ${sn(c.name)}`} labels={byM.map((_, i) => MES[i])} series={[{ name: "Neto", color: "#201e1d", values: byM }]} height={200} asTable={t} />} />
      </div>
      <div className="mb-2 mt-6 flex items-baseline justify-between gap-3"><h3>Contactos</h3><span className="text-xs text-neutral-700">En cobranza se sugiere primero el encargado de pagos.</span></div>
      <div className="scroll-x mb-6">
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Nombre</th><th>Cargo</th><th>Correo</th><th>Teléfono / WhatsApp</th><th>Encargado de pagos</th><th>Contacto incorrecto</th></tr></thead>
          <tbody>
            {c.contacts.map((x) => (
              <tr key={x.id} style={{ height: 44, color: x.incorrecto ? "var(--color-neutral-700)" : undefined, textDecoration: x.incorrecto ? "line-through" : undefined }}>
                <td className="font-bold">{x.nombre}</td><td>{x.cargo}</td><td>{x.email}</td><td>{x.tel}</td>
                <td><input type="checkbox" className="size-4" aria-label={`${x.nombre}: encargado de pagos`} checked={x.pagos} disabled={!canEdit} onChange={(e) => run(setContactFlag({ clientId: id, contactId: x.id, field: "pagos", value: e.target.checked }))} /></td>
                <td><input type="checkbox" className="size-4" aria-label={`${x.nombre}: contacto incorrecto`} checked={x.incorrecto} disabled={!canEdit} onChange={(e) => run(setContactFlag({ clientId: id, contactId: x.id, field: "incorrecto", value: e.target.checked }))} /></td>
              </tr>
            ))}
            {canEdit && (
              <tr className="bg-surface"><td className="!py-2"><input className="input" aria-label="Nombre" maxLength={80} value={ct.nombre} placeholder="Nombre" onChange={(e) => setCt({ ...ct, nombre: e.target.value })} aria-invalid={!!ctErr || undefined} /></td><td><input className="input" aria-label="Cargo" maxLength={80} value={ct.cargo} placeholder="Cargo" onChange={(e) => setCt({ ...ct, cargo: e.target.value })} /></td><td><input className="input" aria-label="Correo" type="email" maxLength={120} value={ct.email} placeholder="correo@empresa.cl" onChange={(e) => setCt({ ...ct, email: e.target.value })} /></td><td><input className="input" aria-label="Teléfono" maxLength={30} value={ct.tel} placeholder="+56 9 …" onChange={(e) => setCt({ ...ct, tel: e.target.value })} /></td><td colSpan={2}><button type="button" className="btn btn-secondary" onClick={addCt}><Plus size={14} aria-hidden />Agregar contacto</button>{ctErr && <span className="field-err ml-2 inline">{ctErr}</span>}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Tabs label="Historial del cliente" value={tab} onChange={setTab} tabs={[{ v: "facturas", l: "Facturas", n: rows.length }, { v: "pagos", l: "Pagos", n: pays.length }, { v: "gestiones", l: "Gestiones", n: gests.length }, { v: "refs", l: "OC y cotizaciones", n: refs.size }]} />
      <div className="overflow-auto border-b-2 border-ink" style={{ ["--row-h" as string]: rowH + "px" }}>
        {tab === "facturas" && <table className="tbl" style={{ minWidth: 860 }}><thead><tr><th>Folio</th><th>Emisión</th><th>Local</th><th>Servicio</th><th>Vence</th><th>Estado</th><th className="r">Total</th><th className="r">Saldo</th></tr></thead><tbody>{rows.map((r) => { const dd = diasInfo(r); return <tr key={r.folio} className="click" onClick={() => openDrawer(r.folio)}><td className="font-extrabold"><button type="button" className="lnk" onClick={(e) => { e.stopPropagation(); openDrawer(r.folio); }}>{r.folio}</button></td><td>{fd(r.emision)}</td><td>{r.sucursal || "—"}</td><td>{r.servicio} <span className="text-xs text-neutral-700">· {condS(r.cond)}</span></td><td>{fd(r.venc)} <span className="text-xs" style={{ color: dd.color }}>{r.saldo > 0 ? dd.text : ""}</span></td><td><StatusBadge status={r.status} /></td><td className="r">{r.anulada ? "$ 0" : clp(r.total)}</td><td className="r font-bold">{r.saldo ? clp(r.saldo) : "—"}</td></tr>; })}</tbody></table>}
        {tab === "pagos" && <table className="tbl" style={{ minWidth: 800 }}><thead><tr><th>Fecha</th><th>Folio</th><th>Medio</th><th>Comprobante</th><th>Recibido por</th><th className="r">Monto</th></tr></thead><tbody>{pays.map(({ p, r }) => <tr key={p.id} className="click" onClick={() => openDrawer(r.folio)}><td>{fd(p.fecha)}</td><td className="font-extrabold">{r.folio}</td><td>{p.medio}</td><td>{p.comp || "—"}</td><td>{p.recibidoPor}</td><td className="r font-bold">{clp(p.monto)}</td></tr>)}</tbody></table>}
        {tab === "gestiones" && <table className="tbl" style={{ minWidth: 800 }}><thead><tr><th>Fecha</th><th>Folio</th><th>Canal</th><th>Contacto</th><th>Resultado</th></tr></thead><tbody>{gests.map(({ g, r }, i) => <tr key={i} className="click" onClick={() => openDrawer(r.folio)}><td>{fd(g.fecha)} {g.hora}</td><td className="font-extrabold">{r.folio}</td><td className="font-bold">{g.canal}</td><td>{g.contacto}</td><td className="max-w-[360px] truncate">{g.resultado}</td></tr>)}</tbody></table>}
        {tab === "refs" && <table className="tbl" style={{ minWidth: 700 }}><thead><tr><th>N° referencia</th><th>Tipo</th><th>Facturas</th><th className="r">Facturado</th><th className="r">Saldo</th></tr></thead><tbody>{[...refs.values()].map((x) => <tr key={x.tipo + x.num} className="click" onClick={() => openModal({ type: "ref", tipo: x.tipo, num: x.num })}><td className="font-extrabold">{x.num}</td><td><span className="tag tag-neutral">{x.tipo}</span></td><td>{x.folios.join(", ")}</td><td className="r">{clp(x.monto)}</td><td className="r font-bold">{clp(x.saldo)}</td></tr>)}</tbody></table>}
        {((tab === "facturas" && !rows.length) || (tab === "pagos" && !pays.length) || (tab === "gestiones" && !gests.length) || (tab === "refs" && !refs.size)) && <p className="px-2 py-8 text-sm text-neutral-700">Sin registros en esta pestaña.</p>}
      </div>
    </>
  );
}

