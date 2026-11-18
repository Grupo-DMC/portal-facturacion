"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, FileText, Hand, Mail, PhoneOff, User } from "lucide-react";
import { useApp } from "../app-context";
import { CanalButtons, Steps } from "../cob-ui";
import { KpiGrid, PageHead, Seg, Tabs } from "../ui";
import { CANALES, addDays } from "@/lib/domain";
import { clp, fd, short, sn } from "@/lib/format";
import { AMB, BAD, GOOD, compLabel } from "@/lib/view";
import type { Row } from "@/lib/types";

type Tab = "agenda" | "lista" | "comps";
type Filter = "todas" | "sin" | "comp";

export function CobranzaView() {
  const { d, cmap, today: T, openDrawer, openModal, canEdit } = useApp();
  const [tab, setTab] = useState<Tab>("agenda");
  const [filter, setFilter] = useState<Filter>("todas");
  const inCob = useMemo(() => d.rows.filter((r) => r.status === "En cobranza").sort((a, b) => (a.venc < b.venc ? -1 : 1)), [d.rows]);
  const tot = inCob.reduce((a, r) => a + r.saldo, 0);
  const sin = inCob.filter((r) => r.nivel === 0);
  const comps = d.rows.filter((r) => r.comp?.compromiso);
  const pend = comps.filter((r) => r.compEstado === "hoy" || r.compEstado === "futuro");
  const inc = comps.filter((r) => r.compEstado === "incumplido");
  const wk = addDays(T, -6);
  const semana = inCob.filter((r) => r.cobDesde! >= wk);

  const agenda = useMemo(() => {
    const used = new Set<number>();
    const take = (xs: Row[]) => xs.filter((r) => { if (used.has(r.folio)) return false; used.add(r.folio); return true; });
    const cards = [
      { title: "Compromisos de hoy e incumplidos", icon: <Hand size={16} aria-hidden />, items: take(inCob.concat(d.rows.filter((r) => r.status !== "En cobranza" && r.compEstado === "hoy")).filter((r) => r.compEstado === "hoy" || r.compEstado === "incumplido")) },
      { title: "Sin gestión: partir con el correo", icon: <PhoneOff size={16} aria-hidden />, items: take(inCob.filter((r) => r.nivel === 0)) },
      { title: "Siguiente: WhatsApp", icon: <Mail size={16} aria-hidden />, items: take(inCob.filter((r) => r.nivel === 1)) },
      { title: "Escalar: otros contactos o llamada", icon: <AlertTriangle size={16} aria-hidden />, items: take(inCob.filter((r) => r.nivel >= 2 && r.compEstado !== "futuro")) },
      { title: "Con compromiso vigente", icon: <CalendarClock size={16} aria-hidden />, items: take(inCob.filter((r) => r.compEstado === "futuro")) },
    ];
    return cards;
  }, [inCob, d.rows]);

  const groups = useMemo(() => {
    const m: Record<string, Row[]> = {};
    inCob.filter((r) => filter === "todas" || (filter === "sin" ? r.nivel === 0 : !!r.comp?.compromiso)).forEach((r) => (m[r.clientId] ??= []).push(r));
    return Object.entries(m).map(([id, rows]) => ({ id, rows, total: rows.reduce((a, r) => a + r.saldo, 0) })).sort((a, b) => b.total - a.total);
  }, [inCob, filter]);

  const estCls = (r: Row) => (r.compEstado === "incumplido" ? { bg: "var(--color-accent-200)", fg: BAD, l: "Incumplido" } : r.compEstado === "cumplido" ? { bg: "var(--color-good-bg)", fg: GOOD, l: "Cumplido" } : r.compEstado === "hoy" ? { bg: "var(--color-warn-bg)", fg: AMB, l: "Hoy" } : { bg: "var(--color-pend-bg)", fg: "var(--color-pend)", l: "Pendiente" });

  return (
    <>
      <PageHead title="Cobranza" sub={<>Escalamiento: 1 Correo → 2 WhatsApp → 3 Otros contactos → 4 Llamada. Una factura pasa sola a cobranza al día hábil siguiente de su vencimiento si no está pagada.</>} />
      <div className="mt-4"><KpiGrid big items={[
        { l: "En cobranza", v: clp(tot), s: `${inCob.length} facturas`, c: inCob.length ? BAD : undefined },
        { l: "Pasaron esta semana", v: String(semana.length), s: short(semana.reduce((a, r) => a + r.saldo, 0)) + " en saldo" },
        { l: "Sin gestión", v: String(sin.length), s: short(sin.reduce((a, r) => a + r.saldo, 0)) + " sin contactar", c: sin.length ? AMB : undefined },
        { l: "Compromisos pendientes", v: String(pend.length), s: short(pend.reduce((a, r) => a + r.comp!.compromiso!.monto, 0)) + " comprometido" },
        { l: "Incumplidos", v: String(inc.length), s: short(inc.reduce((a, r) => a + r.comp!.compromiso!.monto, 0)), c: inc.length ? BAD : undefined },
      ]} /></div>
      <Tabs label="Vistas de cobranza" value={tab} onChange={setTab} tabs={[{ v: "agenda", l: "Mi agenda", n: inCob.length }, { v: "lista", l: "Lista por cliente", n: groups.length }, { v: "comps", l: "Compromisos", n: comps.length }]} />

      {tab === "agenda" && (
        <>
          <p className="py-3 text-[13px] text-neutral-700">Facturas agrupadas por la acción que toca hoy. El botón resaltado es el siguiente paso del escalamiento.</p>
          <div className="grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))" }}>
            {agenda.map((a) => (
              <section key={a.title} className="cell px-4 pb-3 pt-4">
                <div className="mb-2 flex items-center gap-2"><span className="text-accent-700">{a.icon}</span><h4 className="flex-1 text-[15px] font-extrabold">{a.title}</h4><span className="text-xs font-semibold tabular-nums">{a.items.length} · {short(a.items.reduce((s, r) => s + r.saldo, 0))}</span></div>
                {a.items.slice(0, 5).map((r) => (
                  <div key={r.folio} className="flex flex-col gap-1.5 border-t border-neutral-300 py-2.5">
                    <button type="button" onClick={() => openDrawer(r.folio)} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-0 bg-transparent p-0 text-left">
                      <span className="truncate text-[13px] font-bold">{r.folio} · {sn(cmap[r.clientId]?.name)}</span><span className="text-[13px] font-bold tabular-nums">{clp(r.saldo)}</span>
                      <span className="text-xs text-neutral-700">{r.sucursal || r.servicio} · +{r.diasCob} días</span>
                      <span className="whitespace-nowrap text-right text-[11px] font-extrabold uppercase tracking-wider" style={{ color: r.compEstado === "incumplido" ? BAD : AMB }}>{r.comp?.compromiso ? compLabel(r, T).split(" ")[0] : ""}</span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2"><Steps r={r} size="sm" /><span className="flex-1 text-[11px] text-neutral-700">{r.nivel >= 4 ? "Escalamiento completo" : `Siguiente: ${CANALES[Math.min(3, r.nivel)].canal}`}</span>{canEdit && <CanalButtons r={r} />}</div>
                  </div>
                ))}
                {a.items.length > 5 && <button type="button" className="btn btn-ghost mt-1 text-xs" onClick={() => setTab("lista")}>Ver las {a.items.length} en la lista</button>}
                {!a.items.length && <p className="border-t border-neutral-300 py-2.5 text-[13px] text-neutral-700">Nada pendiente.</p>}
              </section>
            ))}
          </div>
        </>
      )}

      {tab === "lista" && (
        <>
          <div className="flex flex-wrap items-center gap-2 py-3"><Seg name="cobf" label="Filtro" value={filter} onChange={setFilter} options={[{ v: "todas", l: "Todas" }, { v: "sin", l: "Sin gestión" }, { v: "comp", l: "Con compromiso" }]} /><span className="text-xs text-neutral-700">{groups.reduce((a, g) => a + g.rows.length, 0)} facturas · {groups.length} clientes</span></div>
          <div className="border-t-2 border-ink">
            {groups.map((g) => {
              const c = cmap[g.id];
              const ct = c.contacts.find((x) => x.pagos && !x.incorrecto) ?? c.contacts[0];
              return (
                <div key={g.id} className="border-b-2 border-divider pb-1">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-2 pt-3.5">
                    <Link href={`/clientes/${g.id}`} className="text-base font-extrabold text-ink no-underline hover:text-accent-700">{sn(c.name)}</Link>
                    <span className="flex min-w-60 flex-1 items-center gap-1.5 text-xs text-neutral-700"><User size={14} aria-hidden /><b className="text-ink">{ct?.nombre}</b> · {ct?.cargo} · {ct?.email} · {ct?.tel}</span>
                    <span className="text-xs text-neutral-700">{g.rows.length} facturas</span>
                    <span className="text-[17px] font-extrabold text-accent-700 tabular-nums">{clp(g.total)}</span>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal({ type: "edo", clientId: g.id })}><FileText size={14} aria-hidden />Estado de cuenta</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="tbl" style={{ minWidth: 1180 }}>
                      <thead><tr><th>Folio</th><th>Local</th><th>Venció</th><th>En cobranza</th><th className="r">Saldo</th><th>Escalamiento</th><th>Última gestión</th><th>Compromiso</th><th className="r">Registrar gestión</th></tr></thead>
                      <tbody>{g.rows.map((r) => (
                        <tr key={r.folio} style={{ height: 46 }}>
                          <td><button type="button" className="lnk" onClick={() => openDrawer(r.folio)}>{r.folio}</button> {r.plan && <span className="text-[10px] font-bold text-accent-700">Cuota {r.plan.n}/{r.plan.of}</span>}</td>
                          <td className="max-w-[180px] truncate text-neutral-700">{r.sucursal || "—"}</td><td>{fd(r.venc)}</td><td className="font-bold text-accent-700">+{r.diasCob} días</td><td className="r font-extrabold">{clp(r.saldo)}</td>
                          <td><Steps r={r} /></td>
                          <td className="max-w-[260px] truncate text-xs" title={r.lastG ? `${r.lastG.canal} · ${r.lastG.resultado}` : ""}>{r.lastG ? `${fd(r.lastG.fecha)} · ${r.lastG.canal}` : <span className="text-accent-700">Sin gestión</span>}</td>
                          <td className="text-xs font-bold" style={{ color: r.compEstado === "incumplido" ? BAD : AMB }}>{r.comp?.compromiso ? compLabel(r, T) : ""}</td>
                          <td><CanalButtons r={r} /></td>
                        </tr>))}</tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {!groups.length && <p className="py-8 text-sm text-neutral-700">No hay facturas en cobranza con este filtro.</p>}
          </div>
        </>
      )}

      {tab === "comps" && (
        <div className="scroll-x !border-t-0">
          <table className="tbl" style={{ minWidth: 1000 }}>
            <thead><tr><th>Estado</th><th>Fecha y hora</th><th>Receptor</th><th>Folio</th><th>Compromiso</th><th className="r">Monto</th><th>Registrado</th></tr></thead>
            <tbody>{comps.sort((a, b) => (a.comp!.compromiso!.fecha < b.comp!.compromiso!.fecha ? 1 : -1)).map((r) => { const e = estCls(r), cp = r.comp!.compromiso!; return (
              <tr key={r.folio} className="click" onClick={() => openDrawer(r.folio)}>
                <td><span className="badge" style={{ background: e.bg, color: e.fg }}>{e.l}</span></td><td className="font-bold">{fd(cp.fecha)} {cp.hora}</td><td className="font-semibold">{sn(cmap[r.clientId]?.name)}</td><td><button type="button" className="lnk" onClick={(ev) => { ev.stopPropagation(); openDrawer(r.folio); }}>{r.folio}</button></td><td>{cp.texto || "—"}</td><td className="r font-bold">{clp(cp.monto)}</td><td className="text-xs text-neutral-700">{fd(r.comp!.fecha)} · {r.comp!.user}</td>
              </tr>); })}</tbody>
          </table>
          {!comps.length && <p className="px-2 py-8 text-sm text-neutral-700">Aún no hay compromisos de pago registrados.</p>}
        </div>
      )}
    </>
  );
}
