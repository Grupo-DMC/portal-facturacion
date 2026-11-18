"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useApp } from "../app-context";
import { Bars, ChartCard, HBars, Lines } from "../charts";
import { PageHead, StatusBadge } from "../ui";
import { mi } from "@/lib/domain";
import { clp, fd, MES, MESL, pctL, short, sn } from "@/lib/format";
import { downloadCsv, INV_COLS, invRow } from "@/lib/export";
import { BAD, GOOD } from "@/lib/view";

export function HistoricoView() {
  const { d, cmap, snap, today: T, openDrawer, rowH } = useApp();
  const [m, setM] = useState(+T.slice(5, 7) - 1);
  const { metas, minimos } = snap.config;
  const rows = d.rows;
  const netoM = (i: number) => rows.filter((r) => !r.anulada && mi(r) === i).reduce((a, r) => a + r.neto, 0);
  const cur = netoM(m), prev = m > 0 ? netoM(m - 1) : snap.y2025[11], y25 = snap.y2025[m];
  const mesRows = useMemo(() => rows.filter((r) => mi(r) === m).sort((a, b) => a.folio - b.folio), [rows, m]);
  const act = mesRows.filter((r) => !r.anulada);
  const comp = (l: string, a: number, b: number, bl: string) => { const p = b ? ((a - b) / b) * 100 : 0; return { l, a: short(a), b: `${bl} ${short(b)}`, delta: `${p >= 0 ? "▲" : "▼"} ${pctL(Math.abs(p))}`, dc: p >= 0 ? GOOD : BAD, w: Math.min(100, b ? (a / Math.max(a, b)) * 100 : 0) + "%", bc: p >= 0 ? "var(--color-good-mark)" : "var(--color-accent)" }; };
  const comps = [comp("vs mes anterior", cur, prev, m > 0 ? MES[m - 1] : "dic 2025"), comp("vs mismo mes 2025", cur, y25, MES[m] + " 2025"), comp("vs meta mensual", cur, metas[m], "meta")];
  const mon = Array.from({ length: m + 1 }, (_, i) => i);
  const byC: Record<string, number> = {}, byS: Record<string, number> = {};
  act.forEach((r) => { byC[r.clientId] = (byC[r.clientId] || 0) + r.neto; byS[r.servicio] = (byS[r.servicio] || 0) + r.neto; });
  let a = 0; const cum: (number | null)[] = []; for (let i = 0; i < 12; i++) { if (i <= +T.slice(5, 7) - 1) { a += netoM(i); cum.push(a); } else cum.push(null); }
  let mc = 0, mn = 0, c25 = 0;
  const metaC = metas.map((v) => (mc += v)), minC = minimos.map((v) => (mn += v)), cum25 = snap.y2025.map((v) => (c25 += v));
  const n12 = Array.from({ length: 12 }, (_, i) => (i <= +T.slice(5, 7) - 1 ? netoM(i) : null));
  return (
    <>
      <PageHead title="Histórico y estadísticas" sub="Datos enero–octubre 2026 importados desde el Excel · 2025 solo con totales mensuales" actions={<><label htmlFor="hm" className="text-[13px]">Mes</label><select id="hm" className="input !w-auto" value={m} onChange={(e) => setM(+e.target.value)}>{Array.from({ length: +T.slice(5, 7) }, (_, i) => <option key={i} value={i}>{MESL[i]} 2026</option>)}</select></>} />
      <div className="mb-6 mt-4 grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))" }}>
        {comps.map((k) => (
          <div key={k.l} className="cell flex flex-col gap-1.5 p-[18px]"><div className="kpi-label">{k.l}</div>
            <div className="flex flex-wrap items-baseline gap-2.5"><span className="text-[26px] font-extrabold tabular-nums">{k.a}</span><span className="text-[13px] text-neutral-700">{k.b}</span></div>
            <div className="text-sm font-bold" style={{ color: k.dc }}>{k.delta}</div>
            <div className="relative h-2 bg-neutral-300"><div className="absolute inset-y-0 left-0" style={{ width: k.w, background: k.bc }} /></div></div>
        ))}
      </div>
      <div className="mb-6 grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,460px),1fr))" }}>
        <ChartCard span title="Facturación acumulada vs meta anual" sub="Neto acumulado 2026, meta y mínimo acumulados, 2025" render={(t) => <Lines label="Facturación acumulada" labels={MES} series={[{ name: "Acumulado 2026", color: "#ec3013", values: cum }, { name: "Meta acumulada", color: "#201e1d", values: metaC }, { name: "Mínimo acumulado", color: "#9b9797", values: minC }, { name: "2025", color: "#bab6b6", values: cum25 }]} asTable={t} height={260} />} />
        <ChartCard title="2026 vs 2025 por mes" sub="Neto facturado · líneas de mínimo y meta" render={(t) => <Bars label="Neto 2026 contra 2025 por mes" labels={MES} series={[{ name: "2025", color: "#bab6b6", values: snap.y2025 }, { name: "2026", color: "#201e1d", values: n12 }]} refLines={[{ value: minimos[m], label: "Mínimo " + short(minimos[m]), color: "#9b9797", tc: "#605d5d" }, { value: metas[m], label: "Meta " + short(metas[m]) }]} asTable={t} />} />
        <ChartCard title={"Ranking de receptores · " + MESL[m].toLowerCase()} sub="Neto del mes" render={(t) => <HBars label="Ranking de receptores del mes" asTable={t} items={Object.keys(byC).sort((x, y) => byC[y] - byC[x]).slice(0, 10).map((id) => ({ id, label: sn(cmap[id]?.name), value: byC[id] }))} />} />
        <ChartCard title={"Ranking de servicios · " + MESL[m].toLowerCase()} sub="Neto del mes" render={(t) => <HBars label="Ranking de servicios del mes" asTable={t} color="#ec3013" items={Object.keys(byS).sort((x, y) => byS[y] - byS[x]).map((k) => ({ label: k, value: byS[k] }))} />} />
      </div>
      <div className="mb-2 flex items-baseline justify-between gap-3"><h3>Libro de {MESL[m].toLowerCase()} <span className="text-[13px] font-normal text-neutral-700">· solo lectura</span></h3><button type="button" className="btn btn-secondary" onClick={() => downloadCsv(`libro_${MESL[m].toLowerCase()}_2026`, INV_COLS, mesRows.map((r) => invRow(r, cmap[r.clientId])))}><Download size={16} aria-hidden />Exportar mes</button></div>
      <div className="scroll-x max-h-[520px]" style={{ ["--row-h" as string]: rowH + "px" }}>
        <table className="tbl sticky-head" style={{ minWidth: 1100 }}>
          <thead><tr><th>Folio</th><th>Emisión</th><th>Receptor</th><th>Local</th><th>Servicio</th><th className="r">Neto</th><th className="r">Total</th><th>Referencia</th><th>Estado</th><th className="r">Saldo</th></tr></thead>
          <tbody>{mesRows.map((r) => { const cot = r.refs.find((x) => x.tipo === "Cotización DMC"), oc = r.refs.find((x) => x.tipo === "OC cliente"); const ex = cmap[r.clientId]?.exigeOC && !oc && !r.anulada; return (
            <tr key={r.folio} className="click" onClick={() => openDrawer(r.folio)}><td className="font-extrabold"><button type="button" className="lnk" onClick={(e) => { e.stopPropagation(); openDrawer(r.folio); }}>{r.folio}</button></td><td>{fd(r.emision)}</td><td className="font-semibold">{sn(cmap[r.clientId]?.name)}</td><td className="text-neutral-700">{r.sucursal || "—"}</td><td>{r.servicio}</td><td className="r">{clp(r.neto)}</td><td className="r">{clp(r.total)}</td><td style={{ color: ex ? BAD : undefined }}>{(cot?.num ?? "") + (oc ? ` · OC ${oc.num}` : ex ? " · Sin OC" : "")}</td><td><StatusBadge status={r.status} /></td><td className="r" style={{ fontWeight: r.saldo ? 700 : 400 }}>{r.saldo ? clp(r.saldo) : "—"}</td></tr>); })}</tbody>
          <tfoot><tr><td colSpan={5}>Totales {MESL[m]} · {act.length} facturas</td><td className="r">{clp(act.reduce((x, r) => x + r.neto, 0))}</td><td className="r">{clp(act.reduce((x, r) => x + r.total, 0))}</td><td colSpan={2} /><td className="r text-accent-700">{clp(act.reduce((x, r) => x + r.saldo, 0))}</td></tr></tfoot>
        </table>
      </div>
    </>
  );
}
