"use client";
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useApp } from "../app-context";
import { PageHead } from "../ui";
import { buildReport, REPORTS, type RepKey } from "@/lib/reports";
import { downloadCsv } from "@/lib/export";
import { MESL, sn } from "@/lib/format";

export function ReportesView() {
  const { snap, today: T } = useApp();
  const [key, setKey] = useState<RepKey>("libro");
  const [month, setMonth] = useState(String(+T.slice(5, 7) - 1));
  const [client, setClient] = useState("walmart");
  const def = REPORTS.find((r) => r.key === key)!;
  const R = useMemo(() => buildReport(snap, key, month, client), [snap, key, month, client]);
  const qs = new URLSearchParams({ month, client }).toString();
  return (
    <>
      <PageHead title="Reportes" sub="Exportación a Excel (CSV) y PDF" />
      <div className="grid items-start" style={{ gridTemplateColumns: "minmax(220px,280px) minmax(0,1fr)" }}>
        <nav aria-label="Reportes disponibles" className="flex flex-col border-r-2 border-divider">
          {REPORTS.map((x) => {
            const on = x.key === key;
            return <button key={x.key} type="button" aria-current={on ? "true" : undefined} onClick={() => setKey(x.key)} className="flex flex-col gap-0.5 border-0 border-b border-divider py-3.5 pr-4 text-left hover:bg-neutral-200" style={{ background: on ? "var(--color-accent-100)" : "transparent", paddingLeft: on ? 12 : 0 }}><span className="text-sm font-extrabold" style={{ color: on ? "var(--color-accent-700)" : undefined }}>{x.l}</span><span className="text-xs text-neutral-700">{x.d}</span></button>;
          })}
        </nav>
        <section className="min-w-0 pl-6 pt-5">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1"><h2 className="text-[22px]">{R.title}</h2><p className="text-[13px] text-neutral-700">{R.desc} · {R.period}</p></div>
            {def.month && <div className="field"><label htmlFor="rep-m">Período</label><select id="rep-m" className="input !w-auto" value={month} onChange={(e) => setMonth(e.target.value)}><option value="all">Año 2026</option>{Array.from({ length: +T.slice(5, 7) }, (_, i) => <option key={i} value={i}>{MESL[i]} 2026</option>)}</select></div>}
            {def.client && <div className="field"><label htmlFor="rep-c">Cliente</label><select id="rep-c" className="input !w-auto max-w-[240px]" value={client} onChange={(e) => setClient(e.target.value)}>{snap.clients.map((c) => <option key={c.id} value={c.id}>{sn(c.name)}</option>)}</select></div>}
            <a className="btn btn-secondary" href={`/api/pdf/reporte/${key}?${qs}`} target="_blank" rel="noopener"><Printer size={16} aria-hidden />PDF</a>
            <button type="button" className="btn btn-primary" onClick={() => downloadCsv(`${key}_${month === "all" ? "2026" : month}`, R.cols.map((c) => c.l), R.raw)}><FileSpreadsheet size={16} aria-hidden /><Download size={16} aria-hidden />Exportar a Excel</button>
          </div>
          <div className="max-h-[calc(100vh-280px)] overflow-auto border-y-2 border-ink bg-bg">
            <table className="tbl sticky-head !text-xs">
              <thead><tr>{R.cols.map((c) => <th key={c.l} className={c.al === "right" ? "r" : ""}>{c.l}</th>)}</tr></thead>
              <tbody>{R.rows.map((r, i) => <tr key={i} style={{ height: 32 }}>{r.map((v, j) => <td key={j} className={R.cols[j].al === "right" ? "r" : ""}>{v}</td>)}</tr>)}</tbody>
              <tfoot><tr>{R.foot.map((v, j) => <td key={j} className={R.cols[j].al === "right" ? "r" : ""}>{v}</td>)}</tr></tfoot>
            </table>
            {!R.rows.length && <p className="px-3 py-8 text-sm text-neutral-700">No hay datos para este período.</p>}
          </div>
          {R.note && <p className="mt-2 text-xs text-neutral-700">{R.note}</p>}
        </section>
      </div>
    </>
  );
}
