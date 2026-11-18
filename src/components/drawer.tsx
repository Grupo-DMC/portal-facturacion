"use client";
import Link from "next/link";
import { AlertTriangle, Ban, Banknote, CalendarArrowDown, Copy, Download, ExternalLink, FileText, Hand, Layers, Lock, Paperclip, Pencil, Phone, Send } from "lucide-react";
import { useApp } from "./app-context";
import { Dlg, StatusBadge, Sub } from "./ui";
import { CANALES } from "@/lib/domain";
import { clp, condL, fd, fdw, sn } from "@/lib/format";
import { AMB, BAD, cobSteps, compLabel, diasInfo } from "@/lib/view";

export function InvoiceDrawer({ folio }: { folio: number }) {
  const { d, cmap, openDrawer, openModal, canEdit, toast, today } = useApp();
  const r = d.byF[folio];
  if (!r) return null;
  const c = cmap[r.clientId];
  const close = () => openDrawer(null);
  const owner = r.localOwner ? cmap[r.localOwner] : null;
  const dias = diasInfo(r);
  const moved = r.vencRaw && r.vencRaw !== r.venc;
  const env = r.envio?.estado === "Enviada";
  const exige = c?.exigeOC && !r.hasOC && !r.anulada;
  const canPay = r.saldo > 0 && canEdit;
  const steps = cobSteps(r);
  const nextCanal = CANALES[Math.min(3, r.nivel)].canal;
  const copy = async () => {
    const t = `Factura N° ${r.folio} · ${c?.name} (RUT ${c?.rut}) · ${condL(r.cond)} · Emisión ${fd(r.emision)} · Vence ${fd(r.venc)} · Neto ${clp(r.neto)} · IVA ${clp(r.iva)} · Total ${clp(r.total)} · Saldo ${clp(r.saldo)}`;
    try { await navigator.clipboard.writeText(t); toast("Datos copiados al portapapeles"); } catch { toast("No se pudo copiar. Selecciona y copia manualmente.", "err"); }
  };
  const open = (fn: () => void) => () => fn();

  return (
    <Dlg drawer onClose={close} titleId="drawer-title"
      kicker="Factura electrónica · folio SII"
      title={
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="tabular-nums">N° {r.folio}</span>
          <StatusBadge status={r.status} className="!px-2.5 !py-1 !text-xs" />
          {r.cond === 0 && <span className="tag tag-outline">Contado</span>}
          {r.plan && <button type="button" onClick={() => openModal({ type: "plan", id: r.plan!.id })} className="tag tag-accent cursor-pointer border-0 text-[11px] font-bold"><Layers size={14} aria-hidden />Cuota {r.plan.n}/{r.plan.of}</button>}
        </span>
      }>
      <div className="flex flex-col gap-[22px] px-6 py-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-neutral-700">Receptor</div>
            <Link href={`/clientes/${r.clientId}`} onClick={close} className="text-[17px] font-extrabold text-ink no-underline hover:text-accent-700">{c?.name}</Link>
            <div className="text-xs text-neutral-700 tabular-nums">RUT {c?.rut}</div>
          </div>
          <div>
            <div className="text-[11px] text-neutral-700">Local / sucursal</div>
            <div className="text-sm font-bold">{r.sucursal || "—"}</div>
            {owner && <div className="text-xs font-semibold text-warn">Guía a nombre de {sn(owner.name)}</div>}
          </div>
        </div>

        <div className="grid border-t-2 border-ink" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr" }}>
          <div className="cell p-3"><div className="kpi-label">Saldo</div><div className="whitespace-nowrap text-[21px] font-extrabold tabular-nums" style={{ color: r.saldo > 0 ? "var(--color-accent-700)" : "var(--color-good)" }}>{clp(r.saldo)}</div></div>
          <div className="cell p-3"><div className="kpi-label">Neto</div><div className="mt-2 text-sm font-semibold tabular-nums">{clp(r.neto)}</div></div>
          <div className="cell p-3" title="Calculado automáticamente"><div className="kpi-label flex items-center gap-1">IVA 19 % <Lock size={12} aria-label="calculado" /></div><div className="mt-2 text-sm font-semibold tabular-nums">{clp(r.iva)}</div></div>
          <div className="cell p-3" title="Calculado automáticamente"><div className="kpi-label flex items-center gap-1">Total <Lock size={12} aria-label="calculado" /></div><div className="mt-2 text-sm font-extrabold tabular-nums">{clp(r.total)}</div></div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {canPay && <button type="button" className="btn btn-primary" onClick={open(() => openModal({ type: "pago", folio }))}><Banknote size={16} aria-hidden />Registrar pago <span className="kbd">P</span></button>}
          {r.status === "En cobranza" && canEdit && <button type="button" className="btn btn-secondary" onClick={open(() => openModal({ type: "gestion", folio }))}><Phone size={14} aria-hidden />Registrar gestión</button>}
          {!env && !r.anulada && canEdit && <button type="button" className="btn btn-secondary" onClick={open(() => openModal({ type: "envio", folio }))}><Send size={14} aria-hidden />Preparar envío</button>}
          {!r.anulada && canEdit && <button type="button" className="btn btn-secondary" onClick={open(() => openModal({ type: "factura", init: { mode: "edit", folio } }))}><Pencil size={14} aria-hidden />Editar</button>}
          {!r.anulada && canEdit && <button type="button" className="btn btn-secondary" onClick={open(() => openModal({ type: "anular", folio }))}><Ban size={14} aria-hidden />Anular con NC</button>}
          <a className="btn btn-ghost" href={`/api/pdf/factura/${r.folio}`} target="_blank" rel="noopener"><Download size={14} aria-hidden />PDF</a>
          <button type="button" className="btn btn-ghost" onClick={copy}><Copy size={14} aria-hidden />Copiar datos</button>
        </div>

        {r.anulada && r.nc && (
          <div className="flex flex-col gap-2.5 border-t-2 border-ink bg-neutral-200 p-3.5 text-[13px]">
            <div className="flex items-start gap-2.5"><Ban size={16} aria-hidden className="mt-0.5" />
              <div className="flex-1"><b className="text-sm">Anulada con nota de crédito N° {r.nc.num}</b><div className="text-neutral-700">{fd(r.nc.fecha)} · {r.nc.motivo}</div>{r.nc.detalle && <div className="mt-1">{r.nc.detalle}</div>}</div></div>
            <div className="flex flex-wrap gap-1.5"><a className="btn btn-secondary !bg-bg" href={`/api/pdf/factura/${r.folio}`} target="_blank" rel="noopener"><Download size={14} aria-hidden />{r.nc.file.name}</a></div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-x-4 gap-y-3.5 text-[13px]">
          <Info l="Emisión" v={fd(r.emision)} />
          <Info l="Condición" v={condL(r.cond)} />
          <div><div className="text-[11px] text-neutral-700">Vencimiento</div><div className="font-semibold tabular-nums">{fd(r.venc)}</div><div className="text-xs font-semibold" style={{ color: dias.color }}>{dias.text}</div></div>
          <Info l="Tipo de servicio" v={r.servicio} />
          <Info l="Pagado" v={clp(r.paid)} />
          <Info l="Origen receptor" v={c?.origin === "local" ? "Creado en Facturación · por validar" : "BD core DMC"} />
          {moved && <div className="col-span-full flex items-center gap-2 text-xs font-semibold text-accent-700"><CalendarArrowDown size={14} aria-hidden />Vencimiento movido del {fdw(r.vencRaw)} al {fdw(r.venc)}</div>}
        </div>

        {r.status === "En cobranza" && (
          <Sub title="Cobranza" right={<span className="font-bold text-accent-700">{`${r.diasCob} días desde el vencimiento · ${r.nivel}/4 pasos`}</span>}>
            <div className="my-2.5 grid grid-cols-4">
              {steps.map((p) => (
                <div key={p.n} className="flex flex-col gap-0.5 border-t-4 py-2 pr-2" style={{ borderTopColor: p.done ? "var(--color-ink)" : p.next ? "var(--color-accent)" : "var(--color-neutral-300)" }}>
                  <span className="text-[11px] font-extrabold" style={{ color: p.next ? "var(--color-accent-700)" : undefined }}>{p.n} · {p.l}</span>
                  <span className="text-[11px] text-neutral-700">{p.when}</span>
                </div>
              ))}
            </div>
            {r.comp?.compromiso && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold" style={r.compEstado === "incumplido" ? { background: "var(--color-accent-200)", color: BAD } : r.compEstado === "cumplido" ? { background: "var(--color-good-bg)", color: "var(--color-good)" } : { background: "var(--color-warn-bg)", color: AMB }}>
                <Hand size={14} aria-hidden />Compromiso: {compLabel(r, today)} · {r.comp.compromiso.texto}
              </div>
            )}
            {r.gestiones.map((g, i) => (
              <div key={i} className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-0.5 border-b border-neutral-300 py-2 text-[13px]">
                <span className="text-neutral-700 tabular-nums">{fd(g.fecha)} {g.hora}</span><span><b>{g.canal}</b> · {g.contacto}</span><span /><span className="text-neutral-700">{g.resultado}</span>
              </div>
            ))}
            {!r.gestiones.length && <div className="py-2 text-[13px] text-accent-700">Sin gestiones registradas. Siguiente paso sugerido: {nextCanal}.</div>}
          </Sub>
        )}

        <Sub title="Envío al cliente" right={<span className="inline-flex items-center gap-1.5 text-xs font-bold"><span style={{ width: 8, height: 8, background: r.anulada ? "transparent" : env ? "var(--color-good-mark)" : "var(--color-accent)" }} />{r.anulada ? "—" : env ? "Enviada" : "No enviada"}</span>}>
          <div className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <span className="text-neutral-700">{env ? `${fd(r.envio.fecha)} · ${r.envio.canal}` : r.anulada ? "Factura anulada" : "Aún no se envía al cliente."}</span>
            {!env && !r.anulada && canEdit && <button type="button" className="btn btn-secondary btn-sm" onClick={open(() => openModal({ type: "envio", folio }))}><Send size={14} aria-hidden />Preparar envío</button>}
          </div>
        </Sub>

        <Sub title="Pagos" right={r.payments.length ? `${r.payments.length} pago${r.payments.length === 1 ? "" : "s"}` : ""}>
          {r.payments.map((p) => (
            <div key={p.id} className="grid grid-cols-[86px_1fr_auto] gap-x-3 gap-y-0.5 border-b border-neutral-300 py-[9px] text-[13px]">
              <span className="tabular-nums">{fd(p.fecha)}</span>
              <span>{p.medio} <span className="text-neutral-700">{p.comp ? `· N° ${p.comp}` : ""}</span></span>
              <span className="text-right font-bold tabular-nums">{clp(p.monto)}</span>
              <span /><span className="text-xs text-neutral-700">Recibido por {p.recibidoPor} {p.nota && `· ${p.nota}`}</span>
              <span className="flex items-center justify-end gap-1 text-xs text-accent-700">{p.file && <><Paperclip size={14} aria-hidden />{p.file.name}</>}</span>
            </div>
          ))}
          {!r.payments.length && <div className="py-3 text-[13px] text-neutral-700">Sin pagos registrados.</div>}
        </Sub>

        <Sub title="Referencias">
          {r.refs.map((x, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-neutral-300 py-[9px] text-[13px]">
              <span className="tag tag-neutral min-w-[110px]">{x.tipo}</span><span className="flex-1 font-bold tabular-nums">{x.num}</span>
              <button type="button" className="btn btn-ghost text-xs" onClick={open(() => openModal({ type: "ref", tipo: x.tipo, num: x.num }))}>Ver facturas<ExternalLink size={14} aria-hidden /></button>
            </div>
          ))}
          {exige && <div className="flex items-center gap-2 py-2.5 text-[13px] font-semibold text-accent-700"><AlertTriangle size={14} aria-hidden />{sn(c.name)} exige OC y esta factura no la tiene.</div>}
          {!r.refs.length && !exige && <div className="py-3 text-[13px] text-neutral-700">Sin referencias.</div>}
        </Sub>

        <Sub title="Adjuntos">
          <div className="grid gap-2.5 pt-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))" }}>
            {r.files.map((f, i) => (
              <div key={i} className="border border-divider bg-surface">
                <div className="m-2 mb-0 flex h-[70px] flex-col gap-1 border border-neutral-300 bg-white p-2">
                  <div className="flex justify-between"><FileText size={14} aria-hidden className="text-neutral-700" /><span className="border border-accent px-1 text-[8px] text-accent-700">{f.kind}</span></div>
                  <div className="h-1 w-[70%] bg-neutral-300" /><div className="h-1 w-1/2 bg-neutral-300" /><div className="mt-1 h-1 w-[85%] bg-neutral-200" />
                </div>
                <div className="px-2 pb-2 pt-1.5 text-[11px]"><div className="truncate font-semibold" title={f.name}>{f.name}</div><div className="text-neutral-700">{f.size}</div></div>
              </div>
            ))}
          </div>
        </Sub>

        {r.obs && <Sub title="Observaciones"><p className="mt-2.5 text-[13px]">{r.obs}</p></Sub>}

        <Sub title="Actividad y auditoría">
          <ol className="m-0 list-none p-0 pt-1.5">
            {r.events.map((e, i) => (
              <li key={i} className="grid grid-cols-[14px_1fr] gap-3 py-2">
                <div className="flex flex-col items-center"><span className="mt-1 size-2.5" style={{ background: e.user === "Sistema" ? "var(--color-neutral-500)" : "var(--color-ink)" }} /><span className="mt-1 w-0.5 flex-1 bg-neutral-300" /></div>
                <div><div className="text-[13px] font-semibold">{e.text}</div><div className="text-xs text-neutral-700 tabular-nums">{fd(e.fecha)} · {e.user}</div></div>
              </li>
            ))}
          </ol>
        </Sub>
      </div>
    </Dlg>
  );
}

const Info = ({ l, v }: { l: string; v: string }) => (
  <div><div className="text-[11px] text-neutral-700">{l}</div><div className="font-semibold">{v}</div></div>
);
