"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useApp } from "../app-context";
import { KpiGrid, PageHead, Seg } from "../ui";
import { addDays, D, mi, nextBiz } from "@/lib/domain";
import { clp, fd, sn } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { BAD, GOOD } from "@/lib/view";

interface Cell { v: string; al?: "r"; w?: number; fg?: string }
interface Sec { title: string; meta: string; cols: { l: string; al?: "r" }[]; rows: { open: () => void; cells: Cell[] }[]; xs: (string | number)[][]; span?: boolean }

export function SemanalView() {
  const { d, cmap, snap, month, today: T, hs, openDrawer } = useApp();
  const [wk, setWk] = useState<0 | 1>(0);
  const W = useMemo(() => {
    const dow = (D(T).getUTCDay() + 6) % 7; // lunes=0
    const mon = addDays(T, -dow);
    const a = wk === 1 ? mon : addDays(mon, -7);
    const b = wk === 1 ? T : addDays(a, 6);
    return { a, b, label: `Semana del ${fd(a)} al ${fd(b)}` };
  }, [wk, T]);

  const S = useMemo(() => {
    const rows = d.rows;
    const inW = (x?: string | null) => !!x && x >= W.a && x <= W.b;
    const fact = rows.filter((r) => !r.anulada && inW(r.emision)).sort((a, b) => (a.emision < b.emision ? -1 : 1));
    const pays: { p: (typeof rows)[number]["payments"][number]; r: (typeof rows)[number] }[] = [];
    rows.forEach((r) => r.payments.forEach((p) => { if (inW(p.fecha)) pays.push({ p, r }); }));
    pays.sort((a, b) => (a.p.fecha < b.p.fecha ? -1 : 1));
    const cob = rows.filter((r) => {
      if (r.anulada) return false;
      const e = nextBiz(addDays(r.venc, 1), hs);
      if (!inW(e) || e > T) return false;
      return r.payments.filter((p) => p.fecha <= r.venc).reduce((a, p) => a + p.monto, 0) < r.total;
    }).sort((a, b) => (a.venc < b.venc ? -1 : 1));
    const comps: { g: (typeof rows)[number]["gestiones"][number]; r: (typeof rows)[number] }[] = [], gests: typeof comps = [];
    rows.forEach((r) => (r.gestiones || []).forEach((g) => { if (g.compromiso && (inW(g.compromiso.fecha) || inW(g.fecha))) comps.push({ g, r }); if (inW(g.fecha)) gests.push({ g, r }); }));
    comps.sort((a, b) => (a.g.compromiso!.fecha < b.g.compromiso!.fecha ? -1 : 1));
    gests.sort((a, b) => ((a.g.fecha + a.g.hora) < (b.g.fecha + b.g.hora) ? -1 : 1));
    const meta = snap.config.metas[month], minimo = snap.config.minimos[month];
    const mesFact = rows.filter((r) => !r.anulada && mi(r) === month).reduce((a, r) => a + r.neto, 0);
    const sum = <X,>(xs: X[], f: (x: X) => number) => xs.reduce((a, x) => a + f(x), 0);
    const fN = sum(fact, (r) => r.neto), pN = sum(pays, (x) => x.p.monto), cN = sum(cob, (r) => r.saldo), kN = sum(comps, (x) => x.g.compromiso!.monto);
    const cEst = (x: (typeof comps)[number]) => (x.r.saldo <= 0 ? "Cumplido" : x.g.compromiso!.fecha < T ? "Incumplido" : "Pendiente");
    const kpis = [
      { l: "Facturado en la semana", v: clp(fN), s: `${fact.length} facturas · neto` },
      { l: "Facturado del mes", v: clp(mesFact), s: `${Math.round((mesFact / meta) * 100)} % de la meta · ${mesFact >= minimo ? "sobre" : "bajo"} el mínimo`, c: mesFact >= meta ? GOOD : mesFact >= minimo ? undefined : BAD },
      { l: "Cobrado en la semana", v: clp(pN), s: `${pays.length} pagos recibidos` },
      { l: "Pasaron a cobranza", v: String(cob.length), s: `${clp(cN)} en saldo`, c: cob.length ? BAD : undefined },
      { l: "Compromisos de pago", v: String(comps.length), s: `${clp(kN)} comprometido` },
      { l: "Gestiones realizadas", v: String(gests.length), s: "Correos, WhatsApp y llamadas" },
    ];
    const nm = (r: (typeof rows)[number]) => sn(cmap[r.clientId]?.name);
    const go = (f: number) => () => openDrawer(f);
    const c = (v: string | number, al?: "r", w?: number, fg?: string): Cell => ({ v: String(v), al, w, fg });
    const sections: Sec[] = [
      { title: "Qué se pagó y cuándo", meta: `${pays.length} · ${clp(pN)}`, cols: [{ l: "Fecha pago" }, { l: "Folio" }, { l: "Receptor" }, { l: "Medio" }, { l: "Recibido por" }, { l: "Monto", al: "r" }], rows: pays.map((x) => ({ open: go(x.r.folio), cells: [c(fd(x.p.fecha)), c(x.r.folio, undefined, 800), c(nm(x.r)), c(x.p.medio), c(x.p.recibidoPor || "—"), c(clp(x.p.monto), "r", 700)] })), xs: pays.map((x) => [fd(x.p.fecha), x.r.folio, cmap[x.r.clientId]?.name, x.p.medio, x.p.recibidoPor || "", x.p.monto]) },
      { title: "Facturado en la semana", meta: `${fact.length} · ${clp(fN)} neto`, cols: [{ l: "Emisión" }, { l: "Folio" }, { l: "Receptor" }, { l: "Local" }, { l: "Servicio" }, { l: "Neto", al: "r" }], rows: fact.map((r) => ({ open: go(r.folio), cells: [c(fd(r.emision)), c(r.folio, undefined, 800), c(nm(r)), c(r.sucursal || "—"), c(r.servicio), c(clp(r.neto), "r", 700)] })), xs: fact.map((r) => [fd(r.emision), r.folio, cmap[r.clientId]?.name, r.sucursal, r.servicio, r.neto]) },
      { title: "Pasó a cobranza", meta: `${cob.length} · ${clp(cN)}`, cols: [{ l: "Desde" }, { l: "Folio" }, { l: "Receptor" }, { l: "Venció" }, { l: "Saldo hoy", al: "r" }], rows: cob.map((r) => ({ open: go(r.folio), cells: [c(fd(nextBiz(addDays(r.venc, 1), hs))), c(r.folio, undefined, 800), c(nm(r)), c(fd(r.venc)), c(r.saldo ? clp(r.saldo) : "Pagada", "r", 700, r.saldo ? BAD : GOOD)] })), xs: cob.map((r) => [fd(nextBiz(addDays(r.venc, 1), hs)), r.folio, cmap[r.clientId]?.name, fd(r.venc), r.saldo]) },
      { title: "Compromisos de pago", meta: `${comps.length} · ${clp(kN)}`, cols: [{ l: "Fecha y hora" }, { l: "Receptor" }, { l: "Folio" }, { l: "Detalle" }, { l: "Monto", al: "r" }, { l: "Estado" }], rows: comps.map((x) => ({ open: go(x.r.folio), cells: [c(`${fd(x.g.compromiso!.fecha)} ${x.g.compromiso!.hora || ""}`, undefined, 700), c(nm(x.r)), c(x.r.folio), c(x.g.compromiso!.texto || "—"), c(clp(x.g.compromiso!.monto), "r", 700), c(cEst(x), undefined, 700, cEst(x) === "Incumplido" ? BAD : cEst(x) === "Cumplido" ? GOOD : undefined)] })), xs: comps.map((x) => [`${fd(x.g.compromiso!.fecha)} ${x.g.compromiso!.hora || ""}`, cmap[x.r.clientId]?.name, x.r.folio, x.g.compromiso!.texto || "", x.g.compromiso!.monto, cEst(x)]) },
      { title: "Gestiones de cobranza hechas", meta: `${gests.length} gestiones`, span: true, cols: [{ l: "Fecha" }, { l: "Receptor" }, { l: "Folio" }, { l: "Canal" }, { l: "Contacto" }, { l: "Resultado" }], rows: gests.map((x) => ({ open: go(x.r.folio), cells: [c(`${fd(x.g.fecha)} ${x.g.hora || ""}`), c(nm(x.r), undefined, 600), c(x.r.folio), c(x.g.canal, undefined, 700), c(x.g.contacto), c(x.g.resultado)] })), xs: gests.map((x) => [`${fd(x.g.fecha)} ${x.g.hora || ""}`, cmap[x.r.clientId]?.name, x.r.folio, x.g.canal, x.g.contacto, x.g.resultado]) },
    ];
    return { kpis, sections };
  }, [d.rows, W, snap.config, month, T, hs, cmap, openDrawer]);

  const exportX = () => {
    const out: (string | number)[][] = [[W.label], []];
    S.kpis.forEach((k) => out.push([k.l, k.v, k.s]));
    S.sections.forEach((sc) => { out.push([], [sc.title.toUpperCase(), sc.meta], sc.cols.map((c) => c.l)); sc.xs.forEach((r) => out.push(r)); });
    downloadCsv(`resumen_semanal_${W.a}_${W.b}`, ["Resumen semanal · DMC Facturación"], out);
  };

  return (
    <>
      <PageHead title="Resumen semanal" sub={`Gerencia · ${W.label}`} actions={<>
        <Seg name="wk" label="Semana" value={String(wk) as "0" | "1"} onChange={(v) => setWk(+v as 0 | 1)} options={[{ v: "0", l: "Semana anterior" }, { v: "1", l: "Semana en curso" }]} />
        <button type="button" className="btn btn-primary" onClick={exportX}><Download size={16} aria-hidden />Exportar resumen semanal a Excel</button>
      </>} />
      <div className="mt-4"><KpiGrid items={S.kpis} /></div>
      <div className="grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,520px),1fr))" }}>
        {S.sections.map((sc) => (
          <section key={sc.title} className="cell p-[18px]" style={sc.span ? { gridColumn: "1 / -1" } : undefined}>
            <div className="mb-2 flex items-baseline justify-between gap-3"><h4 className="text-base font-extrabold">{sc.title}</h4><span className="text-xs text-neutral-700 tabular-nums">{sc.meta}</span></div>
            <div className="max-h-[340px] overflow-auto">
              <table className="tbl !text-xs">
                <thead><tr>{sc.cols.map((c) => <th key={c.l} className={c.al === "r" ? "r" : ""} style={{ position: "sticky", top: 0 }}>{c.l}</th>)}</tr></thead>
                <tbody>{sc.rows.map((r, i) => (
                  <tr key={i} className="click" style={{ height: 34 }} onClick={r.open}>
                    {r.cells.map((c, j) => <td key={j} className={`max-w-[300px] truncate ${c.al === "r" ? "r" : ""}`} style={{ fontWeight: c.w, color: c.fg }}>{j === 1 && sc.title !== "Compromisos de pago" || (sc.title === "Compromisos de pago" && j === 2) ? <button type="button" className="lnk" onClick={(e) => { e.stopPropagation(); r.open(); }}>{c.v}</button> : c.v}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {!sc.rows.length && <p className="py-3 text-[13px] text-neutral-700">Sin movimientos en la semana.</p>}
          </section>
        ))}
      </div>
    </>
  );
}
