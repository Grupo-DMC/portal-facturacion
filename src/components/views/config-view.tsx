"use client";
import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useApp } from "../app-context";
import { MoneyInput, PageHead, Tabs } from "../ui";
import { D, mi } from "@/lib/domain";
import { clp, DOW, fd, MESL } from "@/lib/format";
import { BAD, GOOD } from "@/lib/view";
import { addCatalogItem, addHoliday, removeCatalogItem, removeHoliday, saveMetas, saveTemplates, updateUser } from "@/server/actions";

type Tab = "metas" | "feriados" | "usuarios" | "catalogos" | "plantillas";
const ROLES = { fact: "Facturación", ger: "Gerencia", admin: "Administrador" } as const;
const CATS = [
  { k: "services", l: "Tipos de servicio", d: "Se usan en facturas y reportes", ph: "Nuevo servicio" },
  { k: "medios", l: "Medios de pago", d: "Al registrar un pago", ph: "Nuevo medio" },
  { k: "conds", l: "Condiciones de pago", d: "Días de crédito disponibles", ph: "Días (ej. 45)" },
  { k: "recibidos", l: "Comprobante recibido por", d: "Quién recibe el comprobante", ph: "Nueva persona o área" },
  { k: "motivosNC", l: "Motivos de nota de crédito", d: "Al anular una factura", ph: "Nuevo motivo" },
] as const;

export function ConfigView() {
  const { snap, d, run, busy, user } = useApp();
  const [tab, setTab] = useState<Tab>("metas");
  const cfg = snap.config;
  // metas
  const [metas, setMetas] = useState<(number | null)[]>(cfg.metas);
  const [mins, setMins] = useState<(number | null)[]>(cfg.minimos);
  const real = useMemo(() => Array.from({ length: 12 }, (_, i) => d.rows.filter((r) => !r.anulada && mi(r) === i).reduce((a, r) => a + r.neto, 0)), [d.rows]);
  // feriados
  const [hol, setHol] = useState({ f: "", n: "" });
  const [cat, setCat] = useState<Record<string, string>>({});
  const [tpl, setTpl] = useState({ emailTpl: cfg.emailTpl, envioTpl: cfg.envioTpl });
  const metasOk = metas.every((m, i) => (m ?? 0) >= (mins[i] ?? 0));
  return (
    <>
      <PageHead title="Configuración" sub="Solo Administrador" rule={false} />
      <div className="mb-5"><Tabs label="Configuración" value={tab} onChange={setTab} tabs={[{ v: "metas", l: "Metas mensuales" }, { v: "feriados", l: "Feriados" }, { v: "usuarios", l: "Usuarios y permisos" }, { v: "catalogos", l: "Catálogos" }, { v: "plantillas", l: "Plantillas de correo" }]} /></div>

      {tab === "metas" && (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <p className="max-w-[620px] text-sm text-neutral-700">Facturación neta mensual. Bajo el <b className="text-ink">mínimo</b> la barra del dashboard se pone roja; sobre la <b className="text-ink">meta</b>, verde.</p>
            <div className="flex gap-5 text-sm">Mínimo anual <b className="text-lg tabular-nums">{clp(mins.reduce<number>((a, b) => a + (b ?? 0), 0))}</b> Meta anual <b className="text-lg tabular-nums">{clp(metas.reduce<number>((a, b) => a + (b ?? 0), 0))}</b></div>
          </div>
          <div className="grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
            {MESL.map((l, i) => (
              <div key={l} className="cell flex flex-col gap-2 p-3.5">
                <div className="flex justify-between gap-2 text-[13px]"><b>{l}</b><span className="text-xs font-bold tabular-nums" style={{ color: real[i] >= (metas[i] ?? 0) ? GOOD : real[i] >= (mins[i] ?? 0) ? undefined : BAD }}>{i <= +snap.today.slice(5, 7) - 1 ? clp(real[i]) : ""}</span></div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="field"><label htmlFor={`min${i}`}>Mínimo</label><MoneyInput id={`min${i}`} value={mins[i]} className="!font-bold" onChange={(n) => setMins(mins.map((x, j) => (j === i ? n : x)))} /></div>
                  <div className="field"><label htmlFor={`meta${i}`}>Meta</label><MoneyInput id={`meta${i}`} value={metas[i]} className="!font-bold" invalid={(metas[i] ?? 0) < (mins[i] ?? 0)} onChange={(n) => setMetas(metas.map((x, j) => (j === i ? n : x)))} /></div>
                </div>
              </div>
            ))}
          </div>
          {!metasOk && <p className="field-err mt-2" role="alert">Hay meses con la meta menor que el mínimo.</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-primary" disabled={busy || !metasOk} onClick={() => run(saveMetas({ metas: metas.map((x) => x ?? 0), minimos: mins.map((x) => x ?? 0) }))}>Guardar metas</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setMetas(Array(12).fill(metas[0])); setMins(Array(12).fill(mins[0])); }}>Aplicar mínimo y meta de enero a todos los meses</button>
          </div>
        </>
      )}

      {tab === "feriados" && (
        <div className="grid items-start gap-6" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
          <div className="scroll-x"><table className="tbl"><thead><tr><th>Fecha</th><th>Día</th><th>Feriado</th><th><span className="sr-only">Quitar</span></th></tr></thead><tbody>
            {cfg.holidays.map((h) => <tr key={h.f} style={{ height: 40 }}><td className="font-bold">{fd(h.f)}</td><td className="text-neutral-700">{DOW[D(h.f).getUTCDay()]}</td><td>{h.n}</td><td className="r"><button type="button" className="btn btn-icon !size-7 text-neutral-700" aria-label={`Quitar ${h.n}`} onClick={() => run(removeHoliday({ f: h.f }))}><X size={14} aria-hidden /></button></td></tr>)}
          </tbody></table></div>
          <div className="flex flex-col gap-2.5 border-t-2 border-ink pt-3">
            <h4 className="text-[15px] font-extrabold">Agregar feriado</h4>
            <p className="text-xs text-neutral-700">Si un vencimiento cae en sábado, domingo o feriado se corre al siguiente día hábil. Aplica a las facturas nuevas.</p>
            <div className="field"><label htmlFor="hol-f">Fecha</label><input id="hol-f" type="date" className="input" value={hol.f} onChange={(e) => setHol({ ...hol, f: e.target.value })} /></div>
            <div className="field"><label htmlFor="hol-n">Nombre</label><input id="hol-n" className="input" maxLength={80} value={hol.n} placeholder="Ej. Elecciones" onChange={(e) => setHol({ ...hol, n: e.target.value })} /></div>
            <button type="button" className="btn btn-primary" disabled={busy || !hol.f || !hol.n.trim()} onClick={async () => { const r = await run(addHoliday({ f: hol.f, n: hol.n })); if (r.ok) setHol({ f: "", n: "" }); }}><Plus size={14} aria-hidden />Agregar al calendario</button>
          </div>
        </div>
      )}

      {tab === "usuarios" && (
        <div className="scroll-x">
          <table className="tbl" style={{ minWidth: 760 }}><thead><tr><th>Usuario (core DMC)</th><th>Correo</th><th>Rol</th><th>Permisos</th><th>Activo</th></tr></thead><tbody>
            {snap.users.map((u) => (
              <tr key={u.id} style={{ height: 48 }}>
                <td><div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center bg-ink text-[11px] font-extrabold text-bg" aria-hidden>{u.ini}</span><b>{u.name}</b>{u.id === user.id && <span className="tag tag-neutral">tú</span>}</div></td><td>{u.email}</td>
                <td><select className="input !min-h-8 !w-auto !py-1" aria-label={`Rol de ${u.name}`} value={u.role} disabled={u.id === user.id} onChange={(e) => run(updateUser({ id: u.id, role: e.target.value }))}>{Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td className="text-xs text-neutral-700">{u.role === "ger" ? "Solo lectura · resumen semanal, dashboards y exportar" : u.role === "admin" ? "Acceso total + configuración" : "Acceso total"}</td>
                <td><input type="checkbox" className="size-4" aria-label={`${u.name} activo`} checked={u.active} disabled={u.id === user.id} onChange={(e) => run(updateUser({ id: u.id, active: e.target.checked }))} /></td>
              </tr>))}
          </tbody></table>
        </div>
      )}

      {tab === "catalogos" && (
        <div className="grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))" }}>
          {CATS.map((c) => (
            <div key={c.k} className="cell flex flex-col gap-2.5 p-[18px]">
              <h4 className="text-[15px] font-extrabold">{c.l}</h4><p className="text-xs text-neutral-700">{c.d}</p>
              <ul className="m-0 flex list-none flex-col p-0">{(cfg.catalogs[c.k] as (string | number)[]).map((it) => <li key={String(it)} className="flex items-center justify-between border-b border-neutral-300 py-1.5 text-[13px]"><span>{c.k === "conds" ? (it === 0 ? "Contado" : `${it} días`) : it}</span><button type="button" className="btn btn-icon !size-7 text-neutral-700" aria-label={`Quitar ${it}`} onClick={() => run(removeCatalogItem({ key: c.k, value: String(it) }))}><X size={14} aria-hidden /></button></li>)}</ul>
              <form className="flex gap-1.5" onSubmit={async (e) => { e.preventDefault(); const v = (cat[c.k] || "").trim(); if (!v) return; const r = await run(addCatalogItem({ key: c.k, value: v })); if (r.ok) setCat({ ...cat, [c.k]: "" }); }}>
                <input className="input" aria-label={c.ph} maxLength={60} value={cat[c.k] ?? ""} placeholder={c.ph} onChange={(e) => setCat({ ...cat, [c.k]: e.target.value })} /><button type="submit" className="btn btn-secondary btn-icon shrink-0" aria-label={`Agregar a ${c.l}`}><Plus size={16} aria-hidden /></button>
              </form>
            </div>
          ))}
        </div>
      )}

      {tab === "plantillas" && (
        <>
          <div className="grid items-start gap-6" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
            <div className="field"><label htmlFor="tpl-e">Correo de envío de factura</label><textarea id="tpl-e" className="input !min-h-[280px] leading-normal" maxLength={4000} value={tpl.envioTpl} onChange={(e) => setTpl({ ...tpl, envioTpl: e.target.value })} /><p className="mt-1.5 text-xs text-neutral-700">Variables: {"{folio} {total} {referencia} {vencimiento} {condicion} {contacto} {usuario}"}</p></div>
            <div className="field"><label htmlFor="tpl-c">Correo de cobranza (estado de cuenta)</label><textarea id="tpl-c" className="input !min-h-[280px] leading-normal" maxLength={4000} value={tpl.emailTpl} onChange={(e) => setTpl({ ...tpl, emailTpl: e.target.value })} /><p className="mt-1.5 text-xs text-neutral-700">Variables: {"{contacto} {cliente} {fecha} {monto} {folios} {usuario}"}</p></div>
          </div>
          <div className="mt-3 flex gap-2"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(saveTemplates(tpl))}>Guardar plantillas</button><button type="button" className="btn btn-secondary" onClick={() => setTpl({ emailTpl: cfg.emailTpl, envioTpl: cfg.envioTpl })}>Descartar cambios</button></div>
        </>
      )}
    </>
  );
}
