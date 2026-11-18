"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Clock, Hand, Layers } from "lucide-react";
import { useApp } from "../app-context";
import { Bars, ChartCard, Donut, HBars, Heatmap, Lines } from "../charts";
import { PageHead, Seg } from "../ui";
import { addDays, asOf, diffDays, draftsDue, mi, tramo, TRAMOS } from "@/lib/domain";
import { clp, fd, fdw, MES, MESL, mEnd, mStart, num, pad, pctL, short, sn } from "@/lib/format";
import { AMB, BAD, GOOD, compLabel } from "@/lib/view";
import type { Row } from "@/lib/types";

const TRC = ["#9b9797", "#ffc4b8", "#ff9783", "#dd2b0f", "#7c1405"];
const STC: Record<string, string> = { Pendiente: "oklch(0.62 0.04 250)", "Pago parcial": "oklch(0.52 0.14 255)", "En cobranza": "#ec3013" };
type Period = "mes" | "prev" | "trim" | "anio" | "rango";

export function DashboardView() {
  const { d, cmap, snap, month: m, today: T, openDrawer, openModal } = useApp();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("mes");
  const [rD, setRD] = useState(mStart(m));
  const [rH, setRH] = useState(T);
  const rows = d.rows;
  const { metas, minimos } = snap.config;

  const R = useMemo(() => {
    if (period === "prev") return { a: mStart(m - 1), b: mEnd(m - 1), pa: mStart(m - 2), pb: mEnd(m - 2), label: MESL[(m + 11) % 12] + (m - 1 < 0 ? " 2025" : " 2026"), pl: MES[(m + 10) % 12], ms: [m - 1] };
    if (period === "trim") return { a: mStart(m - 2), b: mEnd(m), pa: mStart(m - 5), pb: mEnd(m - 3), label: `Trimestre ${MES[(m + 10) % 12]}–${MES[m]}`, pl: "trim. anterior", ms: [m - 2, m - 1, m] };
    if (period === "anio") return { a: "2026-01-01", b: mEnd(m), pa: "2025-01-01", pb: "2025-" + mEnd(m).slice(5), label: `Año 2026 (ene–${MES[m].toLowerCase()})`, pl: "2025", ms: Array.from({ length: m + 1 }, (_, i) => i) };
    if (period === "rango") { const a = rD || mStart(m), b = rH || T, len = Math.max(0, diffDays(b, a)); return { a, b, pa: addDays(a, -len - 1), pb: addDays(a, -1), label: `${fd(a)} a ${fd(b)}`, pl: "período anterior", ms: [+a.slice(5, 7) - 1] }; }
    return { a: mStart(m), b: mEnd(m), pa: mStart(m - 1), pb: mEnd(m - 1), label: MESL[m] + " 2026", pl: MES[(m + 11) % 12], ms: [m] };
  }, [period, m, rD, rH, T]);

  const V = useMemo(() => {
    const inR = (x: string, a: string, b: string) => x >= a && x <= b;
    const em = rows.filter((r) => inR(r.emision, R.a, R.b)), pem = rows.filter((r) => inR(r.emision, R.pa, R.pb));
    const factRange = (a: string, b: string) => { let n = 0; rows.forEach((r) => { if (!r.anulada && r.emision >= a && r.emision <= b) n += r.neto; }); for (let i = 0; i < 12; i++) { const ms = `2025-${pad(i + 1)}-01`; if (ms >= a && ms <= b) n += snap.y2025[i]; } return n; };
    const fn = factRange(R.a, R.b), pfn = factRange(R.pa, R.pb);
    const ft = em.filter((r) => !r.anulada).reduce((a, r) => a + r.total, 0);
    const pays = (a: string, b: string) => { let t = 0; rows.forEach((r) => r.payments.forEach((p) => { if (inR(p.fecha, a, b)) t += p.monto; })); return t; };
    const cob = pays(R.a, R.b), pcob = pays(R.pa, R.pb);
    const end = R.b < T ? R.b : T;
    const pc = asOf(rows, end), ppc = asOf(rows, R.pb), ec = asOf(rows, end, "venc"), pec = asOf(rows, R.pb, "venc");
    const dso = (a: string, b: string) => { const xs = rows.filter((r) => r.status === "Pagada" && r.lastPay && inR(r.lastPay.fecha, a, b)).map((r) => diffDays(r.lastPay!.fecha, r.emision)); return xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0; };
    const ds = dso(R.a, R.b), pds = dso(R.pa, R.pb);
    const an = em.filter((r) => r.anulada).length, pan = pem.filter((r) => r.anulada).length;
    const anp = em.length ? (an / em.length) * 100 : 0, panp = pem.length ? (pan / pem.length) * 100 : 0;
    const meta = R.ms.reduce((a, x) => a + (metas[(x + 12) % 12] || 0), 0) || metas[m], minimo = R.ms.reduce((a, x) => a + (minimos[(x + 12) % 12] || 0), 0) || minimos[m];
    const totalDays = diffDays(R.b, R.a) + 1, elapsed = Math.min(totalDays, Math.max(1, diffDays(T, R.a) + 1));
    const proj = R.b > T ? (fn / elapsed) * totalDays : fn;
    const delta = (cur: number, prev: number, goodUp: boolean) => {
      if (!prev) return { delta: `— sin dato ${R.pl}`, dc: "var(--color-neutral-700)" };
      const p = ((cur - prev) / Math.abs(prev)) * 100, up = p >= 0, good = goodUp ? up : !up;
      return { delta: `${up ? "▲ " : "▼ "}${pctL(Math.abs(p))} vs ${R.pl}`, dc: Math.abs(p) < 0.05 ? "var(--color-neutral-700)" : good ? GOOD : BAD };
    };
    const projC = proj >= meta ? GOOD : proj >= minimo ? "var(--color-ink)" : BAD;
    const open = rows.filter((r) => r.saldo > 0);
    const kpis = [
      { l: "Facturado neto", v: clp(fn), s: "Total c/IVA " + clp(ft), ...delta(fn, pfn, true) },
      { l: "Proyección de cierre", v: clp(proj), s: R.b > T ? "Ritmo actual × días del período" : "Período cerrado", delta: proj >= meta ? "▲ Supera la meta por " + short(proj - meta) : proj >= minimo ? "Sobre el mínimo · faltan " + short(meta - proj) + " para la meta" : "▼ Bajo el mínimo por " + short(minimo - proj), dc: projC },
      { l: "Cobrado", v: clp(cob), s: "Pagos recibidos en el período", ...delta(cob, pcob, true) },
      { l: "Por cobrar total", v: clp(pc), s: open.length + " facturas con saldo", ...delta(pc, ppc, false) },
      { l: "En cobranza", v: clp(ec), s: rows.filter((r) => r.status === "En cobranza").length + " facturas vencidas sin pago total", ...delta(ec, pec, false) },
      { l: "Facturas emitidas", v: String(em.length), s: an + " anuladas con NC", ...delta(em.length, pem.length, true) },
      { l: "Días promedio de pago", v: ds ? Math.round(ds) + " días" : "—", s: "DSO facturas pagadas", ...delta(ds, pds, false) },
      { l: "% anuladas", v: pctL(anp), s: `${an} de ${em.length}`, ...delta(anp, panp, false) },
    ];
    const scale = Math.max(meta * 1.12, fn * 1.04, proj * 1.04);
    const col = fn >= meta ? GOOD : fn >= minimo ? "var(--color-ink)" : "var(--color-accent)";
    const metaV = { valueS: short(fn), c: col, stateL: fn >= meta ? "Meta superada" : fn >= minimo ? `Sobre el mínimo · ${Math.round((fn / meta) * 100)} % de la meta` : `Bajo el mínimo · ${Math.round((fn / minimo) * 100)} % del mínimo`, minL: short(minimo), metaLabel: short(meta),
      fillW: (fn / scale) * 100 + "%", projW: Math.min(100, (proj / scale) * 100) + "%", minX: (minimo / scale) * 100 + "%", metaX: (meta / scale) * 100 + "%", projL: clp(proj), projC,
      projState: proj >= meta ? "supera la meta" : proj >= minimo ? "sobre el mínimo, bajo la meta" : "bajo el mínimo", restL: fn >= meta ? "Meta superada por " + clp(fn - meta) : fn >= minimo ? "Faltan " + clp(meta - fn) + " para la meta" : "Faltan " + clp(minimo - fn) + " para el mínimo" };
    // atención hoy
    const wk = addDays(T, -6);
    const v5 = rows.filter((r) => r.saldo > 0 && r.status !== "En cobranza" && r.dias >= 0 && r.dias <= 5).sort((a, b) => a.dias - b.dias);
    const comps = rows.filter((r) => r.compEstado === "hoy" || r.compEstado === "incumplido" || (r.compEstado === "futuro" && r.comp!.compromiso!.fecha <= addDays(T, 1))).sort((a, b) => (a.comp!.compromiso!.fecha < b.comp!.compromiso!.fecha ? -1 : 1));
    const drafts = draftsDue(snap.plans, mEnd(m));
    const entr = rows.filter((r) => r.status === "En cobranza" && r.cobDesde! >= wk).sort((a, b) => (a.cobDesde! < b.cobDesde! ? 1 : -1));
    const att = [
      { title: "Vencen en los próximos 5 días", icon: <Clock size={16} aria-hidden />, count: v5.length, sum: short(v5.reduce((a, r) => a + r.saldo, 0)), items: v5.slice(0, 5).map((r) => ({ title: `${r.folio} · ${sn(cmap[r.clientId]?.name)}`, sub: r.sucursal || r.servicio, amount: clp(r.saldo), tag: r.dias === 0 ? "vence hoy" : "vence " + fdw(r.venc), tc: AMB, go: () => openDrawer(r.folio) })) },
      { title: "Compromisos de pago", icon: <Hand size={16} aria-hidden />, count: comps.length, sum: short(comps.reduce((a, r) => a + r.comp!.compromiso!.monto, 0)), items: comps.slice(0, 5).map((r) => ({ title: `${sn(cmap[r.clientId]?.name)} · ${r.folio}`, sub: r.comp!.compromiso!.texto || r.comp!.contacto, amount: clp(r.comp!.compromiso!.monto), tag: compLabel(r, T).split(" · ")[0].split(" ")[0], tc: r.compEstado === "incumplido" ? BAD : AMB, go: () => openDrawer(r.folio) })) },
      { title: "Cuotas de planes por emitir este mes", icon: <Layers size={16} aria-hidden />, count: drafts.length, sum: short(drafts.reduce((a, x) => a + x.q.neto, 0)), items: drafts.slice(0, 5).map((x) => ({ title: x.p.nombre, sub: `Cuota ${x.q.n}/${x.p.cuotas.length} · ${sn(cmap[x.p.clientId]?.name)}`, amount: clp(x.q.neto), tag: x.q.fechaPlan < T ? "atrasada" : fdw(x.q.fechaPlan), tc: x.q.fechaPlan < T ? BAD : AMB, go: () => openModal({ type: "plan", id: x.p.id }) })) },
      { title: "Pasaron a cobranza esta semana", icon: <AlertTriangle size={16} aria-hidden />, count: entr.length, sum: short(entr.reduce((a, r) => a + r.saldo, 0)), items: entr.slice(0, 5).map((r) => ({ title: `${r.folio} · ${sn(cmap[r.clientId]?.name)}`, sub: "Venció " + fd(r.venc), amount: clp(r.saldo), tag: r.cobDesde === T ? "hoy" : fdw(r.cobDesde), tc: BAD, go: () => openDrawer(r.folio) })) },
    ];
    const cobHoy = rows.filter((r) => r.status === "En cobranza" && r.cobDesde === T).length;
    // series
    const mon = Array.from({ length: m + 1 }, (_, i) => i);
    const fact26 = mon.map((i) => rows.filter((r) => !r.anulada && mi(r) === i).reduce((a, r) => a + r.neto, 0));
    const lab12: string[] = [], val12: number[] = [];
    for (let k = 11; k >= 0; k--) { const i = m - k; if (i < 0) { lab12.push(MES[i + 12] + " 25"); val12.push(snap.y2025[i + 12]); } else { lab12.push(MES[i]); val12.push(fact26[i]); } }
    const factT = mon.map((i) => rows.filter((r) => !r.anulada && mi(r) === i).reduce((a, r) => a + r.total, 0));
    const cobM = mon.map((i) => pays(mStart(i), mEnd(i)));
    const byStat = ["Pendiente", "Pago parcial", "En cobranza"].map((st) => ({ label: st, value: open.filter((r) => r.status === st).reduce((a, r) => a + r.saldo, 0), color: STC[st] }));
    const debtBy: Record<string, { t: number; tr: number[] }> = {};
    open.forEach((r) => { const x = (debtBy[r.clientId] ??= { t: 0, tr: [0, 0, 0, 0, 0] }); x.t += r.saldo; x.tr[tramo(r)] += r.saldo; });
    const topDebt = Object.keys(debtBy).sort((a, b) => debtBy[b].t - debtBy[a].t);
    const ag8 = topDebt.slice(0, 8);
    const factBy: Record<string, number> = {};
    rows.forEach((r) => { if (!r.anulada && r.emision.startsWith("2026")) factBy[r.clientId] = (factBy[r.clientId] || 0) + r.neto; });
    const palette = ["#201e1d", "#ec3013", "#9b9797", "#ff9783", "#605d5d", "#ae1800", "#d7d3d3"];
    const svc = snap.config.catalogs.services.map((sv, i) => ({ label: sv, value: em.filter((r) => !r.anulada && r.servicio === sv).reduce((a, r) => a + r.neto, 0), color: palette[i % 7] })).filter((x) => x.value > 0);
    const medio: Record<string, number> = {};
    rows.forEach((r) => r.payments.forEach((p) => { if (inR(p.fecha, R.a, R.b)) medio[p.medio] = (medio[p.medio] || 0) + p.monto; }));
    const medItems = Object.keys(medio).map((md, i) => ({ label: md, value: medio[md], color: palette[i % 5] }));
    const deuda = mon.map((i) => asOf(rows, i === 9 && m === 9 ? T : mEnd(i))), venc = mon.map((i) => asOf(rows, i === 9 && m === 9 ? T : mEnd(i), "venc"));
    const dsoM = mon.map((i) => Math.round(dso(mStart(i), mEnd(i))) || null);
    const emi = mon.map((i) => rows.filter((r) => mi(r) === i).length), anu = mon.map((i) => rows.filter((r) => mi(r) === i && r.anulada).length);
    const hm: Record<string, { amount: number; count: number }> = {};
    rows.forEach((r) => { if (r.anulada || !r.venc.startsWith(`2026-${pad(m + 1)}`)) return; const x = (hm[r.venc] ??= { amount: 0, count: 0 }); x.amount += r.total; x.count++; });
    let a = 0; const cum: (number | null)[] = []; for (let i = 0; i < 12; i++) { if (i <= m) { a += fact26[i]; cum.push(a); } else cum.push(null); }
    let mc = 0; const metaC = metas.map((v) => (mc += v)); let mn = 0; const minC = minimos.map((v) => (mn += v)); let c25 = 0; const cum25 = snap.y2025.map((v) => (c25 += v));
    return { kpis, metaV, att, cobHoy, entr, mon, L26: mon.map((i) => MES[i]), lab12, val12, factT, cobM, byStat, ag8, debtBy, topDebt, factBy, svc, medItems, deuda, venc, dsoM, emi, anu, hm, cum, metaC, minC, cum25, meta, minimo };
  }, [rows, R, snap, cmap, metas, minimos, m, T, openDrawer, openModal]);

  const nameOf = (id: string) => sn(cmap[id]?.name);
  const go = useMemo(() => ({ fecha: (k: string) => `/facturas?venc=${k}` }), []);
  const entrSum = V.entr.reduce((a: number, r: Row) => a + r.saldo, 0);
  const metaBar = V.metaV;

  return (
    <>
      <PageHead title="Dashboard" sub={`Resumen · ${R.label}`}
        actions={<>
          <Seg name="period" label="Período" value={period} onChange={setPeriod} options={[{ v: "mes", l: MESL[m] }, { v: "prev", l: "Mes anterior" }, { v: "trim", l: "Trimestre" }, { v: "anio", l: "Año 2026" }, { v: "rango", l: "Rango" }]} />
          {period === "rango" && <><input className="input !w-auto" type="date" aria-label="Desde" value={rD} onChange={(e) => setRD(e.target.value)} /><input className="input !w-auto" type="date" aria-label="Hasta" value={rH} max={T} onChange={(e) => setRH(e.target.value)} /></>}
        </>} />
      {V.entr.length > 0 && (
        <Link href="/cobranza" className="flex w-full items-center gap-3 bg-ink px-4 py-3 text-sm text-bg no-underline hover:bg-neutral-800 hover:text-bg">
          <AlertTriangle size={16} className="text-accent-400" aria-hidden /><span className="flex-1"><b className="tabular-nums">{V.cobHoy}</b> pasaron a cobranza hoy · <b className="tabular-nums">{V.entr.length}</b> esta semana <span className="opacity-80">· {short(entrSum)} en saldo</span></span>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">Mi agenda de cobranza<ArrowRight size={14} aria-hidden /></span>
        </Link>
      )}
      <div className="mb-7 mt-4 grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
        <div className="cell flex flex-col gap-2.5 p-[18px]" style={{ gridColumn: "span 2" }}>
          <div className="flex justify-between gap-2 text-[11px] uppercase tracking-[0.08em] text-neutral-700"><span>Facturado neto vs mínimo y meta</span><span>Mín. {metaBar.minL} · Meta {metaBar.metaLabel}</span></div>
          <div className="flex flex-wrap items-baseline gap-3"><span className="text-[40px] font-extrabold leading-none tabular-nums" style={{ color: metaBar.c }}>{metaBar.valueS}</span><span className="text-[13px] font-bold" style={{ color: metaBar.c }}>{metaBar.stateL}</span></div>
          <div className="relative mt-1.5 h-4 bg-neutral-300" role="img" aria-label={`Facturado ${metaBar.valueS}. ${metaBar.stateL}. Mínimo ${metaBar.minL}, meta ${metaBar.metaLabel}.`}>
            <div title="Proyección de cierre" className="absolute inset-y-0 left-0 bg-neutral-400" style={{ width: metaBar.projW }} />
            <div className="absolute inset-y-0 left-0" style={{ width: metaBar.fillW, background: metaBar.c }} />
            <div className="absolute -inset-y-1.5 w-0.5 bg-neutral-700" style={{ left: metaBar.minX }} /><div className="absolute -inset-y-1.5 w-0.5 bg-ink" style={{ left: metaBar.metaX }} />
          </div>
          <div className="relative h-3.5 text-[11px] font-bold"><span className="absolute whitespace-nowrap pl-1.5 text-neutral-700" style={{ left: metaBar.minX }}>Mínimo</span><span className="absolute whitespace-nowrap pl-1.5" style={{ left: metaBar.metaX }}>Meta</span></div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-neutral-700"><span>Proyección de cierre <b className="tabular-nums" style={{ color: metaBar.projC }}>{metaBar.projL}</b> · {metaBar.projState}</span><span>{metaBar.restL}</span></div>
        </div>
        {V.kpis.map((k) => (
          <div key={k.l} className="cell flex flex-col gap-1.5 p-[18px]">
            <div className="kpi-label">{k.l}</div><div className="whitespace-nowrap text-2xl font-extrabold leading-tight tabular-nums">{k.v}</div>
            <div className="text-xs text-neutral-700 tabular-nums">{k.s}</div><div className="text-xs font-semibold tabular-nums" style={{ color: k.dc }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="mb-2.5 flex items-baseline justify-between gap-3"><h3>Requiere atención hoy</h3><span className="text-xs text-neutral-700">{fd(T)}</span></div>
      <div className="mb-7 grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))" }}>
        {V.att.map((a) => (
          <section key={a.title} className="cell px-4 pb-2.5 pt-4">
            <div className="mb-2 flex items-center gap-2"><span className="text-accent-700">{a.icon}</span><h4 className="flex-1 text-sm font-extrabold">{a.title}</h4><span className="whitespace-nowrap text-xs font-semibold tabular-nums">{a.count} · {a.sum}</span></div>
            {a.items.map((it, i) => (
              <button key={i} type="button" onClick={it.go} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-0 border-t border-neutral-300 bg-transparent py-2 pl-0 pr-1 text-left hover:bg-accent-100">
                <span className="truncate text-[13px] font-semibold">{it.title}</span><span className="text-right text-[13px] font-semibold tabular-nums">{it.amount}</span>
                <span className="truncate text-xs text-neutral-700">{it.sub}</span><span className="whitespace-nowrap text-right text-xs font-bold" style={{ color: it.tc }}>{it.tag}</span>
              </button>
            ))}
            {!a.count && <div className="border-t border-neutral-300 py-2.5 text-[13px] text-neutral-700">Nada pendiente.</div>}
          </section>
        ))}
      </div>

      <div className="grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,480px),1fr))" }}>
        <ChartCard span title="Facturado por mes" sub="Neto · últimos 12 meses · mínimo y meta mensual" render={(t) => <Bars label="Facturado neto por mes, últimos 12 meses" labels={V.lab12} series={[{ name: "Facturado neto", color: "#201e1d", values: V.val12 }]} refLines={[{ value: minimos[m], label: "Mínimo " + short(minimos[m]), color: "#9b9797", tc: "#605d5d" }, { value: metas[m], label: "Meta " + short(metas[m]), color: "#ec3013", tc: "#ae1800" }]} asTable={t} height={260} />} />
        <ChartCard title="Facturado vs cobrado" sub="Con IVA · por mes 2026" render={(t) => <Bars label="Facturado versus cobrado por mes" labels={V.L26} series={[{ name: "Facturado", color: "#201e1d", values: V.factT }, { name: "Cobrado", color: "#ec3013", values: V.cobM }]} asTable={t} />} />
        <ChartCard title="Por cobrar por estado" sub={"Saldo vigente al " + fd(T)} render={(t) => <Donut label="Saldo por cobrar por estado" items={V.byStat} asTable={t} centerLabel="Por cobrar" />} />
        <ChartCard title="Antigüedad de deuda" sub="Saldo por días en cobranza · 8 mayores deudores" render={(t) => <Bars label="Antigüedad de la deuda de los 8 mayores deudores" stacked labels={V.ag8.map((id) => nameOf(id).split(" ").slice(0, 2).join(" ").slice(0, 12))} series={TRAMOS.map((tr, i) => ({ name: tr === "Por vencer" ? tr : tr + " días", color: TRC[i], values: V.ag8.map((id) => V.debtBy[id].tr[i]) }))} asTable={t} />} />
        <ChartCard title={"Vencimientos de " + MESL[m].toLowerCase()} sub="Monto total que vence cada día (ya corrido a día hábil)" render={(t) => <Heatmap label="Calendario de vencimientos del mes" year={2026} month={m} days={V.hm} today={T} asTable={t} onPick={(k) => { router.push(go.fecha(k)); }} />} />
        <ChartCard title="Top 10 receptores por facturación" sub="Neto acumulado 2026" render={(t) => <HBars label="Top 10 receptores por facturación" asTable={t} color="#201e1d" items={Object.keys(V.factBy).sort((a, b) => V.factBy[b] - V.factBy[a]).slice(0, 10).map((id) => ({ id, label: nameOf(id), value: V.factBy[id] }))} onPick={(id) => router.push(`/clientes/${id}`)} />} />
        <ChartCard title="Top 10 receptores por deuda" sub="Saldo por cobrar actual" render={(t) => <HBars label="Top 10 receptores por deuda" asTable={t} color="#ec3013" items={V.topDebt.slice(0, 10).map((id) => ({ id, label: nameOf(id), value: V.debtBy[id].t }))} onPick={(id) => router.push(`/clientes/${id}`)} />} />
        <ChartCard title="Facturación por tipo de servicio" sub={"Neto · " + R.label} render={(t) => <Donut label="Facturación por tipo de servicio" items={V.svc} asTable={t} centerLabel="Neto" />} />
        <ChartCard title="Cobrado por medio de pago" sub={R.label} render={(t) => <Donut label="Cobrado por medio de pago" items={V.medItems} asTable={t} centerLabel="Cobrado" />} />
        <ChartCard title="Evolución de la deuda" sub="Saldo por cobrar y en cobranza a fin de cada mes" render={(t) => <Lines label="Evolución de la deuda" labels={V.L26} series={[{ name: "Por cobrar", color: "#201e1d", values: V.deuda }, { name: "En cobranza", color: "#ec3013", values: V.venc }]} asTable={t} />} />
        <ChartCard title="Días promedio de pago (DSO)" sub="Facturas pagadas en cada mes" render={(t) => <Lines label="Días promedio de pago por mes" labels={V.L26} series={[{ name: "Días", color: "#201e1d", values: V.dsoM }]} fmt={(v) => Math.round(v) + " días"} yFmt={(v) => String(Math.round(v))} asTable={t} />} />
        <ChartCard title="Facturas emitidas vs anuladas" sub="Cantidad por mes · anuladas con NC" render={(t) => <Bars label="Facturas emitidas versus anuladas" labels={V.L26} series={[{ name: "Emitidas", color: "#201e1d", values: V.emi }, { name: "Anuladas", color: "#ec3013", values: V.anu }]} fmt={num} yFmt={(v) => String(v)} asTable={t} />} />
        <ChartCard span title="Facturación acumulada vs meta anual" sub={"Neto acumulado 2026 · meta anual " + short(V.metaC[11])} render={(t) => <Lines label="Facturación acumulada contra meta anual" labels={MES} series={[{ name: "Acumulado 2026", color: "#ec3013", values: V.cum }, { name: "Meta acumulada", color: "#201e1d", values: V.metaC }, { name: "Mínimo acumulado", color: "#9b9797", values: V.minC }, { name: "2025", color: "#bab6b6", values: V.cum25 }]} asTable={t} height={260} />} />
      </div>
    </>
  );
}

