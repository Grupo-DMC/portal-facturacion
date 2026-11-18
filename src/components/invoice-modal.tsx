"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarArrowDown, Check, Layers, Lock, Plus, Upload, X } from "lucide-react";
import { useApp, type InvoiceFormInit } from "./app-context";
import { Dlg, Field, MoneyInput, Seg } from "./ui";
import { ClienteModal } from "./cliente-modal";
import { calcIva, calcVenc, rutState } from "@/lib/domain";
import { clp, condKey, fdw, sn, digits } from "@/lib/format";
import { toMeta } from "@/lib/files";
import type { FileMeta, Ref, RefTipo } from "@/lib/types";
import { saveInvoice } from "@/server/actions";

interface Form {
  orig?: number;
  folio: string;
  emision: string;
  clientId: string;
  rutQ: string;
  sucursal: string;
  cond: "0" | "30" | "60" | "otro";
  condN: string;
  venc: string;
  vencRaw: string;
  vencEdited: boolean;
  servicio: string;
  neto: number | null;
  refs: Ref[];
  files: FileMeta[];
  obs: string;
  cuotasOn: boolean;
  nCuotas: string;
  cuotas: { neto: number | null; cond: string }[];
  planRef: { id: string; n: number } | null;
  plan: { id: string; n: number; of: number } | null;
}

export function InvoiceModal({ init }: { init: InvoiceFormInit }) {
  const app = useApp();
  const { snap, d, cmap, hs, today, openModal, run, busy } = app;
  const cat = snap.config.catalogs;
  const nextFolio = Math.max(...snap.invoices.map((i) => i.folio)) + 1;
  const brOwner = useMemo(() => { const m: Record<string, string> = {}; snap.clients.forEach((c) => c.branches.forEach((b) => (m[b] = c.id))); return m; }, [snap.clients]);
  const allBranches = useMemo(() => snap.clients.flatMap((c) => c.branches.map((b) => ({ v: b, l: sn(c.name) }))), [snap.clients]);

  const [f, setF] = useState<Form>(() => {
    const e = today;
    const x = calcVenc(e, 30, hs);
    const base: Form = { folio: String(nextFolio), emision: e, clientId: "", rutQ: "", sucursal: "", cond: "30", condN: "30", venc: x.venc, vencRaw: x.raw, vencEdited: false, servicio: cat.services.includes("Mantención") ? "Mantención" : cat.services[0], neto: null,
      refs: [{ tipo: "Cotización DMC", num: "" }, { tipo: "OC cliente", num: "" }], files: [], obs: "", cuotasOn: false, nCuotas: "3", cuotas: [], planRef: null, plan: null };
    if (init.mode === "edit") {
      const r = d.byF[init.folio];
      return { ...base, orig: r.folio, folio: String(r.folio), emision: r.emision, clientId: r.clientId, rutQ: cmap[r.clientId]?.rut ?? "", sucursal: r.sucursal, cond: condKey(r.cond) as Form["cond"], condN: String(r.cond), venc: r.venc, vencRaw: r.vencRaw || r.venc, vencEdited: true, servicio: r.servicio, neto: r.neto, refs: r.refs.map((x) => ({ ...x })), files: r.files.map((x) => ({ ...x })), obs: r.obs, plan: r.plan };
    }
    if (init.mode === "cuota") {
      const p = snap.plans.find((x) => x.id === init.planId)!;
      const q = p.cuotas.find((x) => x.n === init.n)!;
      const c = cmap[p.clientId];
      let refs = p.refs.map((r) => ({ ...r }));
      if (p.tipo === "calibracion") refs = refs.filter((r) => r.tipo !== "OC cliente");
      if (!refs.some((r) => r.tipo === "OC cliente")) refs.push({ tipo: "OC cliente", num: "" });
      const v = calcVenc(e, q.cond, hs);
      return { ...base, clientId: c.id, rutQ: c.rut, sucursal: p.sucursal, servicio: p.servicio, neto: q.neto, cond: condKey(q.cond) as Form["cond"], condN: String(q.cond), venc: v.venc, vencRaw: v.raw, refs, planRef: { id: p.id, n: q.n }, plan: { id: p.id, n: q.n, of: p.cuotas.length } };
    }
    const f0 = { ...base };
    if (init.ref) f0.refs = f0.refs.map((r) => (r.tipo === init.ref!.tipo ? { ...r, num: init.ref!.num } : r));
    if (init.sucursal) f0.sucursal = init.sucursal;
    if (init.cuotas) { f0.cuotasOn = true; f0.cuotas = [0, 1, 2].map((i) => ({ neto: null, cond: i === 0 ? "0" : "30" })); }
    return f0;
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const [sug, setSug] = useState(false);
  const [warnOC, setWarnOC] = useState(false);
  const [newClient, setNewClient] = useState(false);
  const [drag, setDrag] = useState(false);
  const [fileErr, setFileErr] = useState("");
  const [pendingClient, setPendingClient] = useState("");
  const ocRef = useRef<HTMLInputElement>(null);
  const isNew = !f.orig;
  const c = f.clientId ? cmap[f.clientId] : null;

  const condEff = (x: Form) => (x.cond === "otro" ? +x.condN || 0 : +x.cond);
  const recalcVenc = (x: Form): Form => { const v = calcVenc(x.emision, condEff(x), hs); return { ...x, venc: v.venc, vencRaw: v.raw }; };
  const upd = (patch: Partial<Form>, k?: string) => { setF((s) => ({ ...s, ...patch })); if (k) setErr((e) => ({ ...e, [k]: "" })); setWarnOC(false); };

  const split = (x: Form, n = +x.nCuotas) => {
    const N = Math.max(2, Math.min(12, n || 2));
    const tot = x.neto || 0;
    const base = Math.floor(tot / N / 10) * 10;
    return Array.from({ length: N }, (_, i) => ({ neto: i === N - 1 ? tot - base * (N - 1) : base, cond: x.cuotas[i]?.cond ?? (i === 0 ? "0" : "30") }));
  };

  const pickClient = (id: string) => {
    const cl = cmap[id];
    setF((s) => {
      let x: Form = { ...s, clientId: id, rutQ: cl.rut };
      if (isNew && !s.planRef) {
        x.cond = condKey(cl.cond) as Form["cond"]; x.condN = String(cl.cond);
        if (!x.sucursal) {
          const last = d.rows.filter((r) => r.clientId === id && r.sucursal).sort((a, b) => (a.emision < b.emision ? 1 : -1))[0];
          x.sucursal = last ? last.sucursal : cl.branches[0] || "";
        }
      }
      let refs = x.refs.filter((r) => r.tipo !== "HEP" || cl.hep);
      if (cl.hep && !refs.some((r) => r.tipo === "HEP")) refs = [...refs, { tipo: "HEP", num: "" }];
      if (!refs.some((r) => r.tipo === "OC cliente")) refs = [...refs, { tipo: "OC cliente", num: "" }];
      if (cl.unaOC) { let seen = false; refs = refs.filter((r) => { if (r.tipo !== "OC cliente") return true; if (seen) return false; seen = true; return true; }); }
      x = { ...x, refs };
      if (!x.vencEdited) x = recalcVenc(x);
      return x;
    });
    setSug(false); setWarnOC(false); setErr((e) => ({ ...e, clientId: "" }));
  };

  const onRut = (v: string) => {
    setF((s) => ({ ...s, rutQ: v, clientId: "" }));
    setSug(true);
    const n = v.replace(/[^0-9kK]/g, "").toUpperCase();
    const m = n.length >= 8 ? snap.clients.find((x) => x.rut.replace(/[.\-]/g, "").toUpperCase() === n) : null;
    if (m) pickClient(m.id);
  };

  const sugs = useMemo(() => {
    const q = f.rutQ.trim().toLowerCase();
    const n = q.replace(/[^0-9k]/g, "");
    return snap.clients.filter((x) => !q || x.name.toLowerCase().includes(q) || (n.length >= 2 && x.rut.replace(/[.\-]/g, "").toLowerCase().includes(n))).slice(0, 8);
  }, [f.rutQ, snap.clients]);

  const rs = f.rutQ.length > 2 ? rutState(f.rutQ) : null;
  const lastOC = useMemo(() => {
    if (!f.clientId) return "";
    const r = d.rows.filter((x) => x.clientId === f.clientId && x.refs.some((y) => y.tipo === "OC cliente")).sort((a, b) => (a.emision < b.emision ? 1 : -1))[0];
    return r ? r.refs.find((y) => y.tipo === "OC cliente")!.num : "";
  }, [f.clientId, d.rows]);

  const owner = f.sucursal && brOwner[f.sucursal] && brOwner[f.sucursal] !== f.clientId ? cmap[brOwner[f.sucursal]] : null;
  const first = f.cuotasOn ? f.cuotas[0] : null;
  const netoF = first ? first.neto || 0 : f.neto || 0;
  const iva = calcIva(netoF);
  const ocLocked = !!c?.unaOC && f.refs.some((r) => r.tipo === "OC cliente");
  const canCuotas = isNew && !f.planRef;
  const folioErr = (() => {
    const n = +digits(f.folio);
    if (!n) return "Ingresa el N° emitido en el SII";
    if (snap.invoices.some((i) => i.folio === n && i.folio !== f.orig)) return `El folio ${n} ya existe`;
    return "";
  })();
  const sumC = f.cuotasOn ? f.cuotas.reduce((a, q) => a + (q.neto || 0), 0) : 0;
  const addRef = (tipo: RefTipo) => setF((s) => ({ ...s, refs: [...s.refs, { tipo, num: "" }] }));
  const addFiles = (list: FileList | null) => {
    setFileErr("");
    const ok: FileMeta[] = [];
    for (const file of Array.from(list || [])) { const r = toMeta(file); if (r.ok) ok.push(r.meta); else setFileErr(`${file.name}: ${r.error}`); }
    if (ok.length) setF((s) => ({ ...s, files: [...s.files, ...ok].slice(0, 12) }));
  };

  const submit = async (again: boolean, force = false) => {
    const e: Record<string, string> = {};
    if (!+digits(f.folio)) e.folio = "Ingresa el N° emitido en el SII"; else if (folioErr) e.folio = folioErr;
    if (!f.clientId) e.clientId = "Ingresa un RUT receptor válido";
    if (!f.neto) e.neto = "Ingresa el neto";
    if (f.cond === "otro" && !+f.condN) e.condN = "Indica los días";
    if (f.cuotasOn && sumC !== f.neto) e.neto = `Las cuotas suman ${clp(sumC)} y el neto es ${clp(f.neto || 0)}`;
    if (Object.keys(e).length) { setErr(e); return; }
    const res = await run(saveInvoice({
      orig: f.orig, folio: +digits(f.folio), emision: f.emision, clientId: f.clientId, sucursal: f.sucursal.trim(), servicio: f.servicio, neto: f.neto, cond: condEff(f),
      vencManual: f.vencEdited && !f.cuotasOn ? f.venc : undefined, refs: f.refs.filter((r) => r.num.trim()), files: f.files, obs: f.obs,
      cuotas: f.cuotasOn ? f.cuotas.map((q) => ({ neto: q.neto, cond: +q.cond })) : undefined, planRef: f.planRef ?? undefined, force: force || undefined,
    }));
    if (res.ok) {
      if (again && isNew) {
        setF((s) => ({ ...s, folio: String(+digits(s.folio) + 1), neto: null, files: [], obs: "", refs: s.refs.map((r) => (r.tipo === "OC cliente" || r.tipo === "Cotización DMC" || r.tipo === "HEP" ? { ...r, num: "" } : r)), cuotasOn: false, cuotas: [] }));
        setErr({});
      } else { openModal(null); if (f.orig) app.openDrawer(f.orig); }
    } else if (res.fieldErrors?._warnOC) setWarnOC(true);
    else if (res.fieldErrors) setErr(res.fieldErrors);
  };

  // el cliente recién creado llega con la siguiente instantánea del servidor
  useEffect(() => { if (pendingClient && cmap[pendingClient]) { pickClient(pendingClient); setPendingClient(""); } });

  const title = f.orig ? `Editar factura N° ${f.orig}` : f.planRef ? `Emitir cuota ${f.planRef.n}/${f.plan?.of}` : "Nueva factura";
  const em = (k: string) => (err[k] ? err[k] : undefined);

  return (
    <>
      <Dlg onClose={() => openModal(null)} width={920} kicker={f.orig ? "Se actualizan los datos; el historial queda en la auditoría" : "Registro manual del folio emitido en el portal SII"} title={title}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => openModal(null)}>Cancelar</button>
            {isNew && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => submit(true)}>Guardar y crear otra</button>}
            <button type="button" className="btn btn-primary min-w-40 !justify-between" disabled={busy} onClick={() => submit(false)}>{f.orig ? "Guardar cambios" : f.cuotasOn ? "Emitir cuota 1" : "Guardar factura"}<Check size={16} aria-hidden /></button>
          </>
        }>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,250px),1fr))" }}>
          <Field label="N° de folio (emitido en el portal SII)" error={em("folio") || (f.folio && folioErr ? folioErr : "")}>
            <input className="input !text-base !font-extrabold tabular-nums" value={f.folio} inputMode="numeric" aria-invalid={!!folioErr || undefined} onChange={(e) => upd({ folio: digits(e.target.value) }, "folio")} />
            {!f.orig && <button type="button" onClick={() => upd({ folio: String(nextFolio) })} className="mt-1 border-0 bg-transparent p-0 text-xs text-accent-700 hover:underline">Siguiente: {nextFolio}</button>}
          </Field>
          <Field label="Fecha de emisión" error={em("emision")}>
            <input type="date" className="input" value={f.emision} max={today} onChange={(e) => { const emision = e.target.value; setF((s) => (s.vencEdited ? { ...s, emision } : recalcVenc({ ...s, emision }))); }} />
          </Field>
          <Field label="Tipo de servicio" error={em("servicio")}>
            <select className="input" value={f.servicio} onChange={(e) => upd({ servicio: e.target.value })}>{cat.services.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>

          <div className="relative col-span-full grid items-end gap-x-3 gap-y-2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr) auto" }}>
            <Field label="RUT o razón social del receptor (obligatorio)" error={em("clientId")}>
              <input className="input !font-bold tabular-nums" value={f.rutQ} placeholder="76.042.014-6" autoComplete="off" role="combobox" aria-expanded={sug} aria-invalid={!!err.clientId || undefined}
                onChange={(e) => onRut(e.target.value)} onFocus={() => setSug(true)} onBlur={() => setTimeout(() => setSug(false), 150)} />
            </Field>
            <Field label="Razón social (desde BD core)"><div className="flex min-h-9 items-center bg-neutral-200 px-2.5 text-sm font-bold" style={{ color: c ? undefined : "var(--color-neutral-700)" }}>{c ? c.name : "—"}</div></Field>
            <button type="button" className="btn btn-secondary min-h-9" onClick={() => setNewClient(true)}><Plus size={14} aria-hidden />Cliente nuevo</button>
            <div className="col-span-full flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
              <span className="font-semibold" style={{ color: c ? "var(--color-good)" : rs && !rs.ok ? "var(--color-accent-700)" : "var(--color-neutral-700)" }}>
                {c ? `${c.origin === "core" ? "Cliente en BD core" : "Cliente por validar"} · ${c.branches.length} local(es)` : rs ? rs.msg : ""}
              </span>
              {c?.exigeOC && <span className="tag tag-neutral">Exige OC</span>}
              {c?.unaOC && <span className="tag tag-neutral">Una sola OC por factura</span>}
              {c?.hep && <span className="tag tag-neutral">Requiere HEP</span>}
              {lastOC && !f.refs.some((r) => r.tipo === "OC cliente" && r.num) && (
                <button type="button" className="btn btn-ghost !px-1 text-xs" onClick={() => setF((s) => ({ ...s, refs: s.refs.map((r) => (r.tipo === "OC cliente" ? { ...r, num: lastOC } : r)) }))}>Usar última OC {lastOC}</button>
              )}
            </div>
            {sug && (
              <ul role="listbox" className="absolute inset-x-0 top-16 z-10 m-0 max-h-64 list-none overflow-auto border border-divider bg-bg p-0 shadow-lg">
                {sugs.map((x) => (
                  <li key={x.id} role="option" aria-selected={false}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickClient(x.id)} className="grid w-full grid-cols-[130px_1fr_auto] gap-3 border-0 border-b border-neutral-300 bg-transparent px-3 py-2 text-left text-[13px] hover:bg-accent-100">
                      <span className="font-bold tabular-nums">{x.rut}</span><span className="font-semibold">{x.name}</span><span className="text-xs text-neutral-700">{x.origin === "core" ? "core" : "por validar"}</span>
                    </button>
                  </li>
                ))}
                {!sugs.length && <li className="px-3 py-2.5 text-[13px] text-neutral-700">No está en la BD core. Usa “+ Cliente nuevo”.</li>}
              </ul>
            )}
          </div>

          <Field className="col-span-full" label="Local / sucursal (opcional)" error={em("sucursal")}
            hint={owner ? <span className="text-warn">El local pertenece a {sn(owner.name)}: la guía puede venir a nombre de otro cliente.</span> : c?.branches.length ? `Locales de ${sn(c.name)}: ${c.branches.length}` : undefined}>
            <input className="input" list="dl-inv-suc" value={f.sucursal} maxLength={120} placeholder="Ej. Líder 674 Pedro Fontova" onChange={(e) => upd({ sucursal: e.target.value })} />
            <datalist id="dl-inv-suc">{(c?.branches.length ? c.branches.map((b) => ({ v: b, l: sn(c.name) })) : allBranches).map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}</datalist>
          </Field>

          <Field className="[grid-column:span_2]" label="Condición de pago" error={em("condN")}>
            <Seg name="inv-cond" label="Condición de pago" value={f.cond} onChange={(v) => setF((s) => recalcVenc({ ...s, cond: v, condN: v === "otro" ? s.condN : v, vencEdited: false }))}
              options={[{ v: "0", l: "Contado" }, { v: "30", l: "30 días" }, { v: "60", l: "60 días" }, { v: "otro", l: "Otro" }]} />
            {f.cond === "otro" && (
              <div className="mt-2 flex items-center gap-2 text-[13px]">
                <input className="input !w-20 text-right font-bold" inputMode="numeric" aria-label="Días de crédito" value={f.condN} onChange={(e) => setF((s) => recalcVenc({ ...s, condN: digits(e.target.value).slice(0, 3), vencEdited: false }))} /> días
              </div>
            )}
          </Field>
          <Field label={<>Vencimiento <span className="font-normal text-neutral-700">{f.vencEdited ? "(manual)" : "(automático, a día hábil)"}</span></>} error={em("venc")}>
            <input type="date" className="input" value={f.venc} min={f.emision} onChange={(e) => setF((s) => ({ ...s, venc: e.target.value, vencRaw: e.target.value, vencEdited: true }))} />
            {f.vencRaw && f.vencRaw !== f.venc && (
              <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-accent-700"><CalendarArrowDown size={14} aria-hidden />Cae {fdw(f.vencRaw)}: se corre al {fdw(f.venc)}{snap.config.holidays.find((h) => h.f === f.vencRaw) ? ` · feriado: ${snap.config.holidays.find((h) => h.f === f.vencRaw)!.n}` : " · fin de semana"}</div>
            )}
            {f.vencEdited && <button type="button" onClick={() => setF((s) => recalcVenc({ ...s, vencEdited: false }))} className="mt-1 border-0 bg-transparent p-0 text-xs text-accent-700 hover:underline">Volver al cálculo automático</button>}
          </Field>

          <div className="col-span-full grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
            <div className="cell field p-3">
              <label htmlFor="inv-neto">{f.cuotasOn ? "Neto total del servicio" : "Neto"}</label>
              <MoneyInput id="inv-neto" value={f.neto} invalid={!!err.neto} placeholder="$ 0" className="!text-lg !font-extrabold" onChange={(n) => setF((s) => { const x = { ...s, neto: n }; if (x.cuotasOn) x.cuotas = split(x); return x; })} />
              {err.neto && <div className="field-err">{err.neto}</div>}
            </div>
            <div className="cell cursor-not-allowed bg-neutral-200 p-3" title="Calculado automáticamente" style={{ background: "var(--color-neutral-200)" }}><div className="flex items-center gap-1.5 text-xs text-neutral-700"><Lock size={14} aria-hidden />IVA 19 % · calculado</div><div className="pt-2.5 text-right text-lg font-semibold tabular-nums">{clp(iva)}</div></div>
            <div className="cell cursor-not-allowed p-3" title="Calculado automáticamente" style={{ background: "var(--color-neutral-200)" }}><div className="flex items-center gap-1.5 text-xs text-neutral-700"><Lock size={14} aria-hidden />Total · calculado</div><div className="pt-1.5 text-right text-[22px] font-extrabold tabular-nums">{clp(netoF + iva)}</div></div>
          </div>

          {canCuotas && (
            <div className="col-span-full border border-divider bg-surface">
              <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm font-extrabold">
                  <input type="checkbox" className="size-4" checked={f.cuotasOn} onChange={(e) => setF((s) => { const x = { ...s, cuotasOn: e.target.checked }; x.cuotas = x.cuotasOn ? split(x) : []; return x; })} />
                  <Layers size={14} aria-hidden />Facturar en cuotas <span className="text-xs font-normal text-neutral-700">cada cuota es una factura; la 1 se emite ahora y el resto queda por emitir</span>
                </label>
                {f.cuotasOn && <span className="flex items-center gap-1.5 text-[13px]">N° de cuotas <input className="input !w-16 text-right font-bold" inputMode="numeric" aria-label="Número de cuotas" value={f.nCuotas} onChange={(e) => setF((s) => { const x = { ...s, nCuotas: digits(e.target.value).slice(0, 2) }; x.cuotas = split(x, +x.nCuotas); return x; })} /></span>}
              </div>
              {f.cuotasOn && (
                <>
                  <table className="tbl">
                    <thead><tr><th>Cuota</th><th className="r">Neto</th><th>Condición</th><th className="r">Total c/IVA</th><th>Estado</th></tr></thead>
                    <tbody>
                      {f.cuotas.map((q, i) => (
                        <tr key={i} style={{ height: 44 }}>
                          <td className="font-extrabold">{i + 1}/{f.cuotas.length}</td>
                          <td><MoneyInput aria-label={`Neto cuota ${i + 1}`} value={q.neto} className="!min-h-8 !py-1" onChange={(n) => setF((s) => ({ ...s, cuotas: s.cuotas.map((z, j) => (j === i ? { ...z, neto: n } : z)) }))} /></td>
                          <td><select aria-label={`Condición cuota ${i + 1}`} className="input !min-h-8 !py-1" value={q.cond} onChange={(e) => setF((s) => ({ ...s, cuotas: s.cuotas.map((z, j) => (j === i ? { ...z, cond: e.target.value } : z)) }))}>{cat.conds.map((cd) => <option key={cd} value={cd}>{cd === 0 ? "Contado" : `${cd} días`}</option>)}</select></td>
                          <td className="r">{clp(Math.round((q.neto || 0) * 1.19))}</td>
                          <td className="text-xs font-semibold" style={{ color: i === 0 ? "var(--color-good)" : "var(--color-neutral-700)" }}>{i === 0 ? "Se emite ahora" : "Por emitir"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 text-xs font-semibold" style={{ color: sumC === f.neto ? "var(--color-good)" : "var(--color-accent-700)" }}>{sumC === f.neto ? `Cuotas suman ${clp(sumC)} ✓` : `Las cuotas suman ${clp(sumC)} y el neto es ${clp(f.neto || 0)}`}</div>
                </>
              )}
            </div>
          )}

          <div className="col-span-full">
            <p className="mb-1.5 text-xs text-neutral-700">Referencias · la cotización casi siempre va; la OC se registra junto a ella cuando existe</p>
            {f.refs.map((r, i) => (
              <div key={i} className="mb-1.5 grid items-center gap-2" style={{ gridTemplateColumns: "150px 1fr 36px" }}>
                <span className="tag tag-neutral min-h-9 !justify-start">{r.tipo}</span>
                <input ref={r.tipo === "OC cliente" && i === f.refs.findIndex((x) => x.tipo === "OC cliente") ? ocRef : undefined} className="input tabular-nums" aria-label={`Número de ${r.tipo}`} maxLength={40} value={r.num}
                  placeholder={r.tipo === "Cotización DMC" ? "COT-20896" : r.tipo === "HEP" ? "HEP 1004712" : c?.exigeOC ? "N° de OC (exigida)" : "N° de OC"}
                  onChange={(e) => { setWarnOC(false); setF((s) => ({ ...s, refs: s.refs.map((x, j) => (j === i ? { ...x, num: e.target.value } : x)) })); }} />
                <button type="button" className="btn btn-icon btn-secondary" aria-label={`Quitar ${r.tipo}`} onClick={() => setF((s) => ({ ...s, refs: s.refs.filter((_, j) => j !== i) }))}><X size={14} aria-hidden /></button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className="btn btn-ghost text-[13px]" onClick={() => addRef("Cotización DMC")}><Plus size={14} aria-hidden />Cotización</button>
              {!ocLocked && <button type="button" className="btn btn-ghost text-[13px]" onClick={() => addRef("OC cliente")}><Plus size={14} aria-hidden />OC</button>}
              {ocLocked && <span className="flex items-center gap-1 text-xs text-neutral-700"><Lock size={14} aria-hidden />{sn(c!.name)} usa una sola OC por factura</span>}
              {c?.hep && !f.refs.some((r) => r.tipo === "HEP") && <button type="button" className="btn btn-ghost text-[13px]" onClick={() => addRef("HEP")}><Plus size={14} aria-hidden />HEP (Walmart)</button>}
            </div>
          </div>

          {warnOC && c && (
            <div className="col-span-full flex items-start gap-3 border-t-2 p-3.5" role="alert" style={{ background: "var(--color-warn-bg)", color: "var(--color-warn)", borderColor: "var(--color-warn)" }}>
              <AlertTriangle size={16} className="mt-0.5" aria-hidden />
              <div className="flex-1"><div className="text-sm font-extrabold">Falta la OC de {sn(c.name)}</div><div className="mt-0.5 text-[13px]">Este cliente exige OC para facturar. Sin OC la factura suele ser rechazada.</div>
                <div className="mt-2.5 flex flex-wrap gap-2"><button type="button" className="btn btn-secondary !bg-bg" onClick={() => { setWarnOC(false); ocRef.current?.focus(); }}>Agregar OC</button><button type="button" className="btn btn-secondary !bg-bg" onClick={() => submit(false, true)}>Guardar igual</button></div></div>
            </div>
          )}

          <div className="col-span-full">
            <p className="mb-1.5 text-xs text-neutral-700">Adjuntos · PDF factura, XML (DTE), PDF OC, PDF cotización (máx. 10 MB c/u)</p>
            <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
              className="flex cursor-pointer items-center gap-3 border-2 border-dashed p-4 text-[13px] focus-within:outline focus-within:outline-2 focus-within:outline-accent" style={{ borderColor: drag ? "var(--color-accent)" : "var(--color-divider)", background: drag ? "var(--color-accent-100)" : "var(--color-surface)" }}>
              <Upload size={16} className="text-accent-700" aria-hidden /><span><b>Arrastra los archivos aquí</b> o haz clic para elegirlos</span>
              <input type="file" className="sr-only" multiple accept="application/pdf,.xml,text/xml" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {fileErr && <div className="field-err" role="alert">{fileErr}</div>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.files.map((fl, i) => <span key={i} className="tag tag-neutral !py-1.5 pl-2.5 pr-2"><b>{fl.kind}</b>{fl.name} · {fl.size}<button type="button" aria-label={`Quitar ${fl.name}`} className="flex border-0 bg-transparent p-0" onClick={() => setF((s) => ({ ...s, files: s.files.filter((_, j) => j !== i) }))}><X size={14} aria-hidden /></button></span>)}
              {!f.files.length && <span className="text-xs text-neutral-700">Si no adjuntas, se generan PDF y XML desde el DTE del SII.</span>}
            </div>
          </div>
          <Field className="col-span-full" label="Observaciones" error={em("obs")}><textarea className="input" maxLength={1000} value={f.obs} onChange={(e) => upd({ obs: e.target.value })} /></Field>
        </div>
      </Dlg>
      {newClient && <ClienteModal initialRut={f.rutQ} onClose={() => setNewClient(false)} onCreated={(id) => { setNewClient(false); setPendingClient(id); }} />}
    </>
  );
}
