"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { clp, short } from "@/lib/format";

const INK = "#201e1d", MUT = "#605d5d", GRID = "rgba(32,30,29,.12)", BG = "#f3f2f2";

const nice = (v: number) => {
  const raw = (v || 1) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return { max: step * Math.ceil(v / step), step };
};

function useW(def = 560): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(def);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => { const cw = e[0].contentRect.width; if (cw > 0) setW(cw); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

type Fmt = (n: number) => string;
export interface Series { name: string; color: string; values: (number | null)[] }
export interface RefLine { value: number; label: string; color?: string; tc?: string }

function Legend({ items }: { items: { name: string; color: string; dash?: boolean }[] }) {
  return (
    <div className="mb-2.5 flex flex-wrap gap-4 text-xs text-neutral-700">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {it.dash ? <span style={{ width: 14, borderTop: `2px dashed ${it.color}` }} /> : <span style={{ width: 10, height: 10, background: it.color }} />}
          {it.name}
        </span>
      ))}
    </div>
  );
}

function Tip({ x, y, title, rows, fmt }: { x: number; y: number; title: string; rows: { name: string; color?: string; value: number }[]; fmt: Fmt }) {
  return (
    <div className="pointer-events-none absolute z-10 whitespace-nowrap bg-ink px-2.5 py-2 text-xs leading-snug text-bg shadow-lg" style={{ left: x, top: y, transform: "translate(-50%, calc(-100% - 8px))" }}>
      <div className="mb-0.5 font-extrabold">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5">{r.color && <span style={{ width: 8, height: 8, background: r.color }} />}{r.name}</span>
          <span className="font-semibold tabular-nums">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="tbl">
        <thead><tr>{columns.map((c, i) => <th key={i} className={i ? "r" : ""}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "r" : ""}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const yAxis = (M: number, step: number, y: (v: number) => number, padL: number, W: number, fmt: Fmt) => {
  const out: ReactNode[] = [];
  for (let v = 0; v <= M + 1e-6; v += step) {
    out.push(<line key={"g" + v} x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke={GRID} />);
    out.push(<text key={"t" + v} x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={MUT}>{fmt(v)}</text>);
  }
  return out;
};

export function Bars({ labels, series, stacked, refLines = [], height = 240, fmt = clp, yFmt = short, asTable, label }: {
  labels: string[]; series: Series[]; stacked?: boolean; refLines?: RefLine[]; height?: number; fmt?: Fmt; yFmt?: Fmt; asTable?: boolean; label: string;
}) {
  const [ref, w] = useW();
  const [hi, setHi] = useState(-1);
  if (asTable)
    return <DataTable columns={["Período", ...series.map((s) => s.name), ...(stacked ? ["Total"] : [])]} rows={labels.map((l, i) => [l, ...series.map((s) => fmt(s.values[i] || 0)), ...(stacked ? [fmt(series.reduce((a, s) => a + (s.values[i] || 0), 0))] : [])])} />;
  const padL = 52, padR = 8, padT = 10, padB = 24, W = w, H = height, iw = W - padL - padR, ih = H - padT - padB;
  const tops = labels.map((_, i) => (stacked ? series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...series.map((s) => s.values[i] || 0))));
  const { max: M, step } = nice(Math.max(1, ...tops, ...refLines.map((r) => r.value * 1.12)));
  const y = (v: number) => padT + ih - (v / M) * ih;
  const bw = iw / labels.length, gap = Math.max(2, Math.min(bw * 0.3, 20)), every = bw < 34 ? 2 : 1;
  const els = yAxis(M, step, y, padL, W - padR, yFmt);
  labels.forEach((l, i) => {
    const x0 = padL + bw * i + gap / 2, inner = bw - gap;
    let acc = 0;
    series.forEach((s, k) => {
      const v = s.values[i] || 0;
      if (!v) return;
      const op = hi === -1 || hi === i ? 1 : 0.45;
      if (stacked) { els.push(<rect key={`b${i}-${k}`} x={x0} y={y(acc + v)} width={inner} height={Math.max(0, y(acc) - y(acc + v))} fill={s.color} opacity={op} />); acc += v; }
      else { const sw = inner / series.length; els.push(<rect key={`b${i}-${k}`} x={x0 + sw * k} y={y(v)} width={Math.max(1, sw - (series.length > 1 ? 2 : 0))} height={y(0) - y(v)} fill={s.color} opacity={op} />); }
    });
    if (i % every === 0) els.push(<text key={"l" + i} x={padL + bw * i + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={hi === i ? INK : MUT} fontWeight={hi === i ? 700 : 400}>{l}</text>);
    els.push(<rect key={"h" + i} x={padL + bw * i} y={padT} width={bw} height={ih} fill="transparent" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)} />);
  });
  refLines.forEach((rl, k) => {
    els.push(<line key={"ref" + k} x1={padL} x2={W - padR} y1={y(rl.value)} y2={y(rl.value)} stroke={rl.color || "#ec3013"} strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" />);
    els.push(<text key={"reft" + k} x={W - padR} y={y(rl.value) - 6} textAnchor="end" fontSize={11} fontWeight={700} fill={rl.tc || "#ae1800"} pointerEvents="none">{rl.label}</text>);
  });
  const leg = [...series.map((s) => ({ name: s.name, color: s.color })), ...refLines.map((r) => ({ name: r.label, color: r.color || "#ec3013", dash: true }))];
  return (
    <div ref={ref} className="relative w-full">
      <Legend items={leg} />
      <svg width={W} height={H} role="img" aria-label={label} className="block overflow-visible">{els}</svg>
      {hi >= 0 && <Tip x={padL + bw * hi + bw / 2} y={y(tops[hi]) + 28} title={labels[hi]} fmt={fmt} rows={[...series.map((s) => ({ name: s.name, color: s.color, value: s.values[hi] || 0 })), ...(stacked ? [{ name: "Total", value: tops[hi] }] : [])]} />}
    </div>
  );
}

export function Lines({ labels, series, refLine, height = 240, fmt = clp, yFmt = short, asTable, label }: {
  labels: string[]; series: Series[]; refLine?: RefLine; height?: number; fmt?: Fmt; yFmt?: Fmt; asTable?: boolean; label: string;
}) {
  const [ref, w] = useW();
  const [hi, setHi] = useState(-1);
  if (asTable) return <DataTable columns={["Período", ...series.map((s) => s.name)]} rows={labels.map((l, i) => [l, ...series.map((s) => (s.values[i] == null ? "—" : fmt(s.values[i]!)))])} />;
  const padL = 52, padR = 12, padT = 10, padB = 24, W = w, H = height, iw = W - padL - padR, ih = H - padT - padB, n = labels.length;
  const all: number[] = [];
  series.forEach((s) => s.values.forEach((v) => v != null && all.push(v)));
  if (refLine) all.push(refLine.value);
  const { max: M, step } = nice(Math.max(1, ...all) * 1.05);
  const x = (i: number) => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = (v: number) => padT + ih - (v / M) * ih;
  const els = yAxis(M, step, y, padL, W - padR, yFmt);
  const every = iw / n < 34 ? 2 : 1;
  labels.forEach((l, i) => { if (i % every === 0) els.push(<text key={"l" + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill={hi === i ? INK : MUT} fontWeight={hi === i ? 700 : 400}>{l}</text>); });
  if (refLine) els.push(<line key="ref" x1={padL} x2={W - padR} y1={y(refLine.value)} y2={y(refLine.value)} stroke={refLine.color || "#ec3013"} strokeWidth={2} strokeDasharray="6 4" />);
  series.forEach((s, k) => {
    const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as const))).filter(Boolean) as (readonly [number, number])[];
    if (!pts.length) return;
    els.push(<polyline key={"p" + k} fill="none" stroke={s.color} strokeWidth={2.5} points={pts.map((p) => p.join(",")).join(" ")} />);
    pts.forEach((p, i) => els.push(<rect key={`d${k}-${i}`} x={p[0] - 3} y={p[1] - 3} width={6} height={6} fill={s.color} />));
  });
  labels.forEach((_, i) => els.push(<rect key={"h" + i} x={x(i) - iw / n / 2} y={padT} width={iw / n} height={ih} fill="transparent" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)} />));
  if (hi >= 0) els.push(<line key="hl" x1={x(hi)} x2={x(hi)} y1={padT} y2={padT + ih} stroke={INK} strokeOpacity={0.35} />);
  const top = hi >= 0 ? Math.min(...series.map((s) => (s.values[hi] == null ? Infinity : y(s.values[hi]!)))) : 0;
  return (
    <div ref={ref} className="relative w-full">
      <Legend items={[...series.map((s) => ({ name: s.name, color: s.color })), ...(refLine ? [{ name: refLine.label, color: refLine.color || "#ec3013", dash: true }] : [])]} />
      <svg width={W} height={H} role="img" aria-label={label} className="block overflow-visible">{els}</svg>
      {hi >= 0 && Number.isFinite(top) && <Tip x={x(hi)} y={top + 28} title={labels[hi]} fmt={fmt} rows={series.filter((s) => s.values[hi] != null).map((s) => ({ name: s.name, color: s.color, value: s.values[hi]! }))} />}
    </div>
  );
}

export function Donut({ items, centerLabel, fmt = clp, asTable, label }: { items: { label: string; value: number; color: string }[]; centerLabel: string; fmt?: Fmt; asTable?: boolean; label: string }) {
  const [hi, setHi] = useState(-1);
  const total = items.reduce((a, b) => a + b.value, 0);
  if (asTable) return <DataTable columns={["Categoría", "Monto", "%"]} rows={[...items.map((it) => [it.label, fmt(it.value), total ? ((it.value / total) * 100).toFixed(1) + " %" : "—"]), ["Total", fmt(total), "100 %"]]} />;
  const R = 70, r = 46, C = 90;
  let a0 = -Math.PI / 2;
  const arcs = items.filter((it) => it.value > 0).map((it, idx) => {
    const a1 = a0 + (it.value / (total || 1)) * Math.PI * 2 - (items.length > 1 ? 0.01 : 0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
    const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1), [x2, y2] = p(r, a1), [x3, y3] = p(r, a0);
    const d = `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
    a0 += (it.value / (total || 1)) * Math.PI * 2;
    return <path key={idx} d={d} fill={it.color} opacity={hi === -1 || hi === idx ? 1 : 0.4} onMouseEnter={() => setHi(idx)} onMouseLeave={() => setHi(-1)} />;
  });
  const act = hi >= 0 ? items.filter((i) => i.value > 0)[hi] : null;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={180} height={180} role="img" aria-label={label}>
        {arcs}
        <text x={C} y={C - 4} textAnchor="middle" fontSize={11} fill={MUT}>{act ? act.label : centerLabel}</text>
        <text x={C} y={C + 14} textAnchor="middle" fontSize={15} fontWeight={800} fill={INK}>{short(act ? act.value : total)}</text>
      </svg>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            <span style={{ width: 10, height: 10, background: it.color }} />
            <span className="flex-1">{it.label}</span>
            <span className="font-semibold tabular-nums">{fmt(it.value)}</span>
            <span className="w-12 text-right text-xs text-neutral-700 tabular-nums">{total ? Math.round((it.value / total) * 100) : 0} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ items, color = INK, fmt = clp, asTable, onPick, label, valueLabel = "Monto" }: {
  items: { label: string; value: number; id?: string }[]; color?: string; fmt?: Fmt; asTable?: boolean; onPick?: (id: string) => void; label: string; valueLabel?: string;
}) {
  if (asTable) return <DataTable columns={["Ítem", valueLabel]} rows={items.map((i) => [i.label, fmt(i.value)])} />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label={label}>
      {items.map((it, i) => {
        const inner = (
          <>
            <span className="w-32 shrink-0 truncate text-left text-xs sm:w-40" title={it.label}>{it.label}</span>
            <span className="relative h-4 flex-1 bg-neutral-200"><span className="absolute inset-y-0 left-0" style={{ width: (it.value / max) * 100 + "%", background: color }} /></span>
            <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums">{fmt(it.value)}</span>
          </>
        );
        return (
          <li key={i}>
            {onPick && it.id ? <button type="button" onClick={() => onPick(it.id!)} className="flex w-full items-center gap-2 border-0 bg-transparent p-0 hover:bg-accent-100">{inner}</button> : <div className="flex items-center gap-2">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Calendario del mes: cada día muestra el monto que vence. */
export function Heatmap({ year, month, days, today, onPick, asTable, label }: {
  year: number; month: number; days: Record<string, { amount: number; count: number }>; today: string; onPick?: (iso: string) => void; asTable?: boolean; label: string;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (asTable) return <DataTable columns={["Día", "Facturas", "Monto"]} rows={Object.keys(days).sort().map((k) => [k.split("-").reverse().join("-"), String(days[k].count), clp(days[k].amount)])} />;
  const max = Math.max(1, ...Object.values(days).map((d) => d.amount));
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  return (
    <div role="group" aria-label={label}>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-neutral-700">{["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const v = days[iso];
          const a = v ? 0.12 + 0.88 * (v.amount / max) : 0;
          const isToday = iso === today;
          const dark = a > 0.5;
          const content = (
            <>
              <span className="text-[11px] font-bold">{d}</span>
              {v && <span className="text-[10px] tabular-nums">{short(v.amount)}</span>}
            </>
          );
          const style = { background: v ? `rgba(236,48,19,${a})` : "var(--color-neutral-200)", color: dark ? "#fff" : INK, outline: isToday ? "2px solid #201e1d" : undefined, outlineOffset: -2 };
          return v && onPick ? (
            <button key={i} type="button" onClick={() => onPick(iso)} title={`${v.count} facturas · ${clp(v.amount)}`} className="flex h-11 flex-col items-center justify-center border-0 p-0" style={style}>{content}</button>
          ) : (
            <div key={i} className="flex h-11 flex-col items-center justify-center" style={style}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}

/** Tarjeta de gráfico con alternancia gráfico ⇄ tabla (alternativa accesible). */
export function ChartCard({ title, sub, span, render }: { title: string; sub: string; span?: boolean; render: (asTable: boolean) => ReactNode }) {
  const [t, setT] = useState(false);
  return (
    <section className="cell p-5" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div><h4 className="text-[15px] font-extrabold">{title}</h4><p className="text-xs text-neutral-700">{sub}</p></div>
        <button type="button" className="btn btn-ghost !px-1.5 !py-1 text-xs" onClick={() => setT(!t)} aria-pressed={t}>
          {t ? <BarChart3 size={14} aria-hidden /> : <Table2 size={14} aria-hidden />}{t ? "Ver gráfico" : "Ver tabla"}
        </button>
      </div>
      {render(t)}
    </section>
  );
}

