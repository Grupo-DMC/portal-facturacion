"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, Hand, Mail, Paperclip, Send, Upload } from "lucide-react";
import { useApp } from "./app-context";
import { Dlg, Field, MoneyInput, Seg, StatusBadge } from "./ui";
import { CanalIcon } from "./cob-ui";
import { CANALES, planInfo, suggestContact } from "@/lib/domain";
import { clp, condL, digits, fd, fillTemplate, sn } from "@/lib/format";
import { toMeta } from "@/lib/files";
import type { Canal, EnvioCanal, FileMeta } from "@/lib/types";
import { anularFactura, registerGestion, registerPayment, sendCorreoCobranza, sendEnvio } from "@/server/actions";

const kickerOf = (folio: number, name?: string) => `Factura ${folio} · ${name ? sn(name) : ""}`;

function FilePick({ label, onPick, only, invalid }: { label: string; onPick: (m: FileMeta | null, error?: string) => void; only?: "pdf" | "pdf-image"; invalid?: boolean }) {
  return (
    <label className="flex min-h-[38px] cursor-pointer items-center gap-2 border border-dashed px-2.5 text-[13px] focus-within:outline focus-within:outline-2 focus-within:outline-accent" style={{ borderColor: invalid ? "var(--color-accent-600)" : "var(--color-divider)", background: "var(--color-surface)" }}>
      <Upload size={14} aria-hidden /><span className="truncate">{label}</span>
      <input type="file" className="sr-only" accept={only === "pdf" ? "application/pdf" : "image/*,application/pdf"}
        onChange={(e) => { const fl = e.target.files?.[0]; if (!fl) return; const r = toMeta(fl, { only }); r.ok ? onPick(r.meta) : onPick(null, r.error); e.target.value = ""; }} />
    </label>
  );
}

// ───────────────────────── Registrar pago ─────────────────────────
export function PagoModal({ folio, partial }: { folio: number; partial?: boolean }) {
  const { d, cmap, snap, today, openModal, run, busy } = useApp();
  const r = d.byF[folio];
  const cat = snap.config.catalogs;
  const [f, setF] = useState({ fecha: today, monto: partial ? (null as number | null) : r.saldo, medio: cat.medios[0], recibido: cat.recibidos[0], comp: "", nota: "" });
  const [file, setFile] = useState<FileMeta | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const close = () => openModal(null);
  const rest = r.saldo - (f.monto || 0);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.monto) e.monto = "Ingresa el monto"; else if (f.monto > r.saldo) e.monto = `Supera el saldo (${clp(r.saldo)})`;
    if (f.fecha > today) e.fecha = "La fecha no puede ser futura";
    if (f.fecha < r.emision) e.fecha = "Es anterior a la emisión";
    if (Object.keys(e).length) return setErr(e);
    const res = await run(registerPayment({ folio, fecha: f.fecha, monto: f.monto, medio: f.medio, recibidoPor: f.recibido, comp: f.comp.trim(), nota: f.nota.trim(), file }));
    if (res.ok) close(); else if (res.fieldErrors) setErr(res.fieldErrors);
  };
  return (
    <Dlg onClose={close} kicker={kickerOf(folio, cmap[r.clientId]?.name)} title="Registrar pago" width={560}
      footer={<><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>Registrar pago</button></>}>
      <div className="mb-4 grid grid-cols-2 border-t-2 border-ink">
        <div className="cell p-2.5" style={{ background: "var(--color-surface)" }}><div className="text-[11px] text-neutral-700">Total factura</div><div className="font-bold tabular-nums">{clp(r.total)}</div></div>
        <div className="cell p-2.5" style={{ background: "var(--color-surface)" }}><div className="text-[11px] text-neutral-700">Saldo actual</div><div className="font-extrabold text-accent-700 tabular-nums">{clp(r.saldo)}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha en que llegó el comprobante" error={err.fecha}><input type="date" className="input" value={f.fecha} max={today} min={r.emision} onChange={(e) => { setF({ ...f, fecha: e.target.value }); setErr({ ...err, fecha: "" }); }} /></Field>
        <Field label="Monto" error={err.monto}><MoneyInput value={f.monto} invalid={!!err.monto} className="!font-extrabold" autoFocus={!!partial} onChange={(n) => { setF({ ...f, monto: n }); setErr({ ...err, monto: "" }); }} /></Field>
        <Field className="col-span-full" label="Medio de pago"><Seg name="pmedio" label="Medio de pago" value={f.medio} onChange={(v) => setF({ ...f, medio: v })} options={cat.medios.map((m) => ({ v: m, l: m }))} /></Field>
        <Field className="col-span-full" label="Comprobante recibido por"><Seg name="prec" label="Recibido por" value={f.recibido} onChange={(v) => setF({ ...f, recibido: v })} options={cat.recibidos.map((m) => ({ v: m, l: m }))} /></Field>
        <Field label="N° de comprobante"><input className="input" value={f.comp} maxLength={40} placeholder="Ej. 8812044" onChange={(e) => setF({ ...f, comp: e.target.value })} /></Field>
        <Field label="Adjuntar comprobante" error={err.file}><FilePick label={file?.name ?? "Elegir PDF o imagen"} only="pdf-image" onPick={(m, er) => { setFile(m ?? file); setErr({ ...err, file: er ?? "" }); }} /></Field>
        <Field className="col-span-full" label="Nota"><input className="input" value={f.nota} maxLength={300} placeholder="Ej. Abono acordado por WhatsApp" onChange={(e) => setF({ ...f, nota: e.target.value })} /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setF({ ...f, monto: r.saldo })}>Pago total</button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setF({ ...f, monto: Math.round(r.saldo / 2) })}>50 %</button>
        <span className="flex-1" /><span className="text-[13px]">Saldo después: <b className="tabular-nums">{clp(Math.max(0, rest))}</b></span>
      </div>
      <p className="mt-3 bg-surface px-2.5 py-2 text-xs text-neutral-700" style={{ background: "var(--color-neutral-200)" }}>
        {rest <= 0 ? "Con este pago la factura queda Pagada y pasa sola a la vista Pagadas." : r.status === "En cobranza" ? "Abono parcial: la factura sigue En cobranza por el saldo." : "Abono parcial: la factura queda en Pago parcial."} La fecha cuenta como fecha de cobro.
      </p>
    </Dlg>
  );
}

// ───────────────────────── Anular con NC ─────────────────────────
export function AnularModal({ folio }: { folio: number }) {
  const { d, cmap, snap, today, openModal, run, busy } = useApp();
  const r = d.byF[folio];
  const cat = snap.config.catalogs;
  const [f, setF] = useState({ nc: snap.ncNext, fecha: today, motivo: cat.motivosNC[0], detalle: "" });
  const [file, setFile] = useState<FileMeta | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const close = () => openModal(null);
  const dup = snap.invoices.some((i) => i.nc && +i.nc.num === f.nc);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.nc) e.nc = "Ingresa el N° de NC"; else if (dup) e.nc = `La NC ${f.nc} ya existe`;
    if (f.motivo === "Otro" && !f.detalle.trim()) e.detalle = "Describe el motivo";
    if (!file) e.file = "Adjunta el PDF de la nota de crédito";
    if (Object.keys(e).length) return setErr(e);
    const res = await run(anularFactura({ folio, nc: f.nc, ncFecha: f.fecha, motivo: f.motivo, detalle: f.detalle.trim(), file }));
    if (res.ok) { close(); } else if (res.fieldErrors) setErr(res.fieldErrors);
  };
  return (
    <Dlg onClose={close} kicker={`${kickerOf(folio, cmap[r.clientId]?.name)} · ${clp(r.total)}`} title="Anular con nota de crédito" width={560}
      footer={<><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>Anular factura</button></>}>
      <p className="mb-4 text-sm">La factura no se elimina: queda en el libro como <b>Anulada</b>, deja de sumar a los totales y la NC queda como respaldo.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="N° nota de crédito" error={err.nc || (dup ? `La NC ${f.nc} ya existe` : "")}><input className="input !font-extrabold tabular-nums" inputMode="numeric" value={f.nc || ""} onChange={(e) => { setF({ ...f, nc: +digits(e.target.value) }); setErr({ ...err, nc: "" }); }} /></Field>
        <Field label="Fecha de la NC" error={err.ncFecha}><input type="date" className="input" value={f.fecha} max={today} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
      </div>
      <fieldset className="mt-4 border-0 p-0">
        <legend className="mb-1.5 text-xs font-semibold text-neutral-700">Motivo</legend>
        <div className="flex flex-col border-t border-divider">
          {cat.motivosNC.map((m) => <label key={m} className="flex cursor-pointer items-center gap-2.5 border-b border-neutral-300 py-[9px] text-sm"><input type="radio" name="ncmot" className="size-4" checked={f.motivo === m} onChange={() => setF({ ...f, motivo: m })} />{m}</label>)}
        </div>
      </fieldset>
      <Field className="mt-4" label={f.motivo === "Otro" ? "Detalle (obligatorio)" : "Detalle (opcional)"} error={err.detalle}><textarea className="input" maxLength={500} value={f.detalle} placeholder="Ej. El portal rechazó el N° de OC" onChange={(e) => { setF({ ...f, detalle: e.target.value }); setErr({ ...err, detalle: "" }); }} /></Field>
      <Field className="mt-4" label="PDF de la nota de crédito (obligatorio)" error={err.file}><FilePick label={file?.name ?? "Elegir PDF de la NC"} only="pdf" invalid={!!err.file} onPick={(m, er) => { if (m) setFile(m); setErr({ ...err, file: er ?? "" }); }} /></Field>
    </Dlg>
  );
}

// ───────────────────────── Gestión de cobranza ─────────────────────────
export function GestionModal({ folio, canal }: { folio: number; canal?: string }) {
  const { d, cmap, today, openModal, run, busy } = useApp();
  const r = d.byF[folio];
  const c = cmap[r.clientId];
  const open = d.rows.filter((x) => x.clientId === c.id && x.status === "En cobranza");
  const c0 = (canal as Canal) || CANALES[Math.min(3, r.nivel)].canal;
  const now = new Date();
  const [f, setF] = useState({ canal: c0, contactoId: suggestContact(c, c0), fecha: today, hora: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, resultado: "", hasComp: false, compFecha: "", compHora: "13:00", compMonto: r.saldo as number | null, compTexto: "" });
  const [sel, setSel] = useState<Record<number, boolean>>({ [folio]: true });
  const [err, setErr] = useState<Record<string, string>>({});
  const close = () => openModal(null);
  const tomorrow = new Date(new Date(today + "T00:00:00Z").getTime() + 864e5).toISOString().slice(0, 10);
  const submit = async () => {
    const folios = Object.keys(sel).filter((k) => sel[+k]).map(Number);
    const e: Record<string, string> = {};
    if (!folios.length) e.folios = "Selecciona al menos una factura";
    if (!f.resultado.trim()) e.resultado = "Describe el resultado";
    if (f.hasComp && !f.compMonto) e.compMonto = "Monto requerido";
    if (Object.keys(e).length) return setErr(e);
    const res = await run(registerGestion({ folios, clientId: c.id, canal: f.canal, contactoId: f.contactoId, fecha: f.fecha, hora: f.hora, resultado: f.resultado.trim(),
      compromiso: f.hasComp ? { fecha: f.compFecha || tomorrow, hora: f.compHora, monto: f.compMonto, texto: f.compTexto.trim() } : null }));
    if (res.ok) close(); else if (res.fieldErrors) setErr(res.fieldErrors);
  };
  return (
    <Dlg onClose={close} kicker={`${sn(c.name)} · nivel actual ${r.nivel}/4`} title="Registrar gestión de cobranza" width={680}
      footer={<><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>Guardar gestión</button></>}>
      <fieldset className="border-0 p-0">
        <legend className="mb-1.5 text-xs font-semibold text-neutral-700">Canal</legend>
        <div className="grid grid-cols-2 border-t-2 border-ink sm:grid-cols-4">
          {CANALES.map((k, i) => {
            const on = f.canal === k.canal, next = i === Math.min(3, r.nivel);
            return (
              <button key={k.canal} type="button" aria-pressed={on} onClick={() => setF({ ...f, canal: k.canal, contactoId: suggestContact(c, k.canal) })}
                className="flex flex-col items-start gap-1 border-0 p-2.5 text-left text-[13px] font-bold" style={{ boxShadow: "inset -1px 0 0 var(--color-divider), inset 0 -1px 0 var(--color-divider)", background: on ? "var(--color-accent)" : "var(--color-surface)", color: on ? "#fff" : undefined }}>
                <CanalIcon name={k.icon} /><span>{i + 1} · {k.canal}</span><span className="text-[11px] font-semibold opacity-90">{i < r.nivel ? "ya hecho" : next ? "siguiente paso" : ""}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="mt-4 border-0 p-0">
        <legend className="mb-1.5 text-xs font-semibold text-neutral-700">Facturas incluidas</legend>
        <div className="flex flex-col border-t border-divider">
          {open.map((x) => (
            <label key={x.folio} className="grid cursor-pointer grid-cols-[20px_70px_1fr_auto_auto] items-center gap-2.5 border-b border-neutral-300 py-2 text-[13px] tabular-nums">
              <input type="checkbox" className="size-4" checked={!!sel[x.folio]} onChange={() => { setSel({ ...sel, [x.folio]: !sel[x.folio] }); setErr({ ...err, folios: "" }); }} />
              <b>{x.folio}</b><span className="truncate text-neutral-700">{x.sucursal || "—"}</span><span className="text-xs font-semibold text-accent-700">+{x.diasCob} d</span><b>{clp(x.saldo)}</b>
            </label>
          ))}
        </div>
        {(err.folios) && <div className="field-err">{err.folios}</div>}
      </fieldset>
      <fieldset className="mt-4 border-0 p-0">
        <legend className="mb-1.5 text-xs font-semibold text-neutral-700">Contacto</legend>
        <div className="flex flex-col border-t border-divider">
          {c.contacts.map((ct) => (
            <label key={ct.id} className="flex cursor-pointer items-center gap-2.5 border-b border-neutral-300 py-2 text-[13px]" style={{ color: ct.incorrecto ? "var(--color-neutral-700)" : undefined }}>
              <input type="radio" name="gcont" className="size-4" checked={f.contactoId === ct.id} onChange={() => setF({ ...f, contactoId: ct.id })} />
              <span className="flex-1"><b className={ct.incorrecto ? "line-through" : ""}>{ct.nombre}</b> · {ct.cargo} <span className="text-xs text-neutral-700">{f.canal === "Correo" ? ct.email : ct.tel}</span></span>
              {ct.pagos && <span className="tag tag-accent !text-[10px]">Encargado de pagos</span>}{ct.incorrecto && <span className="tag tag-neutral !text-[10px]">Contacto incorrecto</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Fecha"><input type="date" className="input" value={f.fecha} max={today} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
        <Field label="Hora"><input type="time" className="input" value={f.hora} onChange={(e) => setF({ ...f, hora: e.target.value })} /></Field>
        <Field className="col-span-full" label="Resultado" error={err.resultado}><textarea className="input" maxLength={1000} value={f.resultado} placeholder="Qué se conversó, quién respondió…" onChange={(e) => { setF({ ...f, resultado: e.target.value }); setErr({ ...err, resultado: "" }); }} /></Field>
        <label className="col-span-full flex cursor-pointer items-center gap-2.5 text-sm font-bold"><input type="checkbox" className="size-4" checked={f.hasComp} onChange={(e) => setF({ ...f, hasComp: e.target.checked, compFecha: f.compFecha || tomorrow })} /><Hand size={14} aria-hidden />El cliente compromete un pago</label>
        {f.hasComp && (
          <>
            <Field label="Fecha del compromiso"><input type="date" className="input" value={f.compFecha || tomorrow} min={today} onChange={(e) => setF({ ...f, compFecha: e.target.value })} /></Field>
            <Field label="Hora"><input type="time" className="input" value={f.compHora} onChange={(e) => setF({ ...f, compHora: e.target.value })} /></Field>
            <Field label="Monto" error={err.compMonto}><MoneyInput value={f.compMonto} className="!font-bold" onChange={(n) => setF({ ...f, compMonto: n })} /></Field>
            <Field label="Qué se compromete"><input className="input" value={f.compTexto} maxLength={200} placeholder="Ej. Envía comprobante mañana 13:00" onChange={(e) => setF({ ...f, compTexto: e.target.value })} /></Field>
          </>
        )}
      </div>
    </Dlg>
  );
}

// ───────────────────────── Envío al cliente ─────────────────────────
export function EnvioModal({ folio }: { folio: number }) {
  const { d, cmap, snap, today, openModal, run, busy, user } = useApp();
  const r = d.byF[folio];
  const c = cmap[r.clientId];
  const ct = c.contacts.find((x) => x.pagos && !x.incorrecto) ?? { nombre: "", email: "", tel: "" };
  const oc = r.refs.find((x) => x.tipo === "OC cliente"), cot = r.refs.find((x) => x.tipo === "Cotización DMC");
  const refL = oc ? `la OC ${oc.num}` : cot ? `la cotización ${cot.num}` : "el servicio prestado";
  const body = fillTemplate(snap.config.envioTpl, { contacto: ct.nombre, folio: r.folio, total: clp(r.total), referencia: refL, vencimiento: fd(r.venc), condicion: condL(r.cond), usuario: user.name });
  const [f, setF] = useState({ canal: (c.hep ? "Portal Walmart" : "Correo") as EnvioCanal, para: ct.email, asunto: `Factura N° ${r.folio} · Comercializadora DMC SpA${oc ? ` · OC ${oc.num}` : ""}`, cuerpo: body, ck1: false, ck2: false, ck3: false });
  const [err, setErr] = useState<Record<string, string>>({});
  const close = () => openModal(null);
  const adj = [{ name: `Factura_${r.folio}.pdf`, kind: "PDF factura" }, ...(c.hep ? [{ name: `DTE_${r.folio}.xml`, kind: "XML" }] : []), ...(oc ? [{ name: `OC_${oc.num}.pdf`, kind: "PDF OC" }] : cot ? [{ name: `${cot.num}.pdf`, kind: "PDF cotización" }] : [])];
  const cta = f.canal === "Correo" ? "Enviar correo" : f.canal === "Portal Walmart" ? "Confirmar subida al portal" : "Registrar envío";
  const submit = async () => {
    if (f.canal === "Correo" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.para)) return setErr({ para: "Correo inválido" });
    if (f.canal === "Portal Walmart" && !(f.ck1 && f.ck2)) return setErr({ ck: "Confirma que subiste el PDF y el XML al portal" });
    const res = await run(sendEnvio({ folio, canal: f.canal, para: f.para, asunto: f.asunto, cuerpo: f.cuerpo, ck1: f.ck1, ck2: f.ck2 }));
    if (res.ok) close(); else if (res.fieldErrors) setErr(res.fieldErrors);
  };
  const canales: EnvioCanal[] = c.hep ? ["Correo", "Portal Walmart", "WhatsApp"] : ["Correo", "WhatsApp"];
  return (
    <Dlg onClose={close} kicker={kickerOf(folio, c.name)} title="Preparar envío al cliente" width={660}
      footer={<><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}><Send size={14} aria-hidden />{cta}</button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Canal"><Seg name="ecan" label="Canal de envío" value={f.canal} onChange={(v) => { setF({ ...f, canal: v }); setErr({}); }} options={canales.map((v) => ({ v, l: v }))} /></Field>
        <Field label="Adjuntos"><div className="flex flex-wrap gap-1.5">{adj.map((a) => <span key={a.name} className="tag tag-neutral !px-2.5 !py-1.5"><Paperclip size={14} aria-hidden /><b>{a.kind}</b>{a.name}</span>)}</div></Field>
        {f.canal === "Portal Walmart" && (
          <div className="flex flex-col gap-2 border-t-2 border-ink bg-surface px-3.5 py-3">
            <div className="flex items-center gap-2 text-sm font-extrabold"><Upload size={14} aria-hidden />Subir PDF + XML al portal Walmart</div>
            {([["ck1", "PDF de la factura subido"], ["ck2", "XML (DTE) subido"], ["ck3", `OC ${oc?.num ?? ""} y HEP referenciadas en el portal`]] as const).map(([k, l]) => <label key={k} className="flex cursor-pointer items-center gap-2.5 text-[13px]"><input type="checkbox" className="size-4" checked={f[k]} onChange={(e) => { setF({ ...f, [k]: e.target.checked }); setErr({}); }} />{l}</label>)}
            {err.ck && <div className="field-err">{err.ck}</div>}
          </div>
        )}
        {f.canal === "Correo" && (
          <>
            <Field label="Para" error={err.para}><input className="input" type="email" value={f.para} maxLength={120} aria-invalid={!!err.para || undefined} onChange={(e) => { setF({ ...f, para: e.target.value }); setErr({}); }} /></Field>
            <Field label="Asunto"><input className="input" value={f.asunto} maxLength={200} onChange={(e) => setF({ ...f, asunto: e.target.value })} /></Field>
            <Field label="Mensaje"><textarea className="input !min-h-[200px] leading-normal" maxLength={4000} value={f.cuerpo} onChange={(e) => setF({ ...f, cuerpo: e.target.value })} /></Field>
          </>
        )}
        {f.canal === "WhatsApp" && <p className="bg-neutral-200 px-3 py-2.5 text-[13px] text-neutral-700">Se registra el envío por WhatsApp a <b className="text-ink">{ct.tel || "—"}</b> con el PDF de la factura y {refL}.</p>}
      </div>
    </Dlg>
  );
}

// ───────────────────────── Plan de cuotas ─────────────────────────
export function PlanModal({ id }: { id: string }) {
  const { d, snap, cmap, openModal, openDrawer, canEdit } = useApp();
  const p = snap.plans.find((x) => x.id === id);
  if (!p) return null;
  const pi = planInfo(p, d.byF);
  const close = () => openModal(null);
  const nextEmit = pi.next?.n;
  return (
    <Dlg onClose={close} kicker={`${p.tipo === "calibracion" ? "Plan de calibración" : "Facturación en cuotas"} · ${sn(cmap[p.clientId]?.name)} · ${p.id}`} title={p.nombre} width={900}
      footer={<button type="button" className="btn btn-secondary" onClick={close}>Cerrar</button>}>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap justify-between gap-3 text-[13px]"><span>Pagado <b className="tabular-nums">{clp(pi.paid)}</b> de {clp(pi.total)}</span><span className="text-neutral-700">{pi.emit} de {pi.of} emitidas · {pi.pag} pagadas</span></div>
        <div className="relative h-3 bg-neutral-300" role="progressbar" aria-valuenow={Math.round((pi.paid / (pi.total || 1)) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de pago del plan"><div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, (pi.paid / (pi.total || 1)) * 100)}%`, background: "var(--color-good-mark)" }} /></div>
      </div>
      <div className="mt-4 grid border-t-2 border-ink" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))" }}>
        {pi.cs.map((q) => {
          const cls = q.est === "Por emitir" ? "st-poremitir" : q.est === "Emitida" ? "st-emitida" : q.est === "Pagada" ? "st-pagada" : q.est === "En cobranza" ? "st-cobranza" : q.est === "Pago parcial" ? "st-parcial" : "st-anulada";
          return (
            <div key={q.n} className="-mt-0.5 flex flex-col gap-1.5 border-t-4 py-3 pr-3" style={{ borderTopColor: q.est === "Pagada" ? "var(--color-good-mark)" : q.r ? "var(--color-ink)" : "var(--color-neutral-300)", boxShadow: "inset -2px 0 0 var(--color-divider), inset 0 -2px 0 var(--color-divider)" }}>
              <div className="flex justify-between gap-1.5 pl-3"><b className="text-sm">{q.n}/{pi.of}</b><span className="text-[11px] text-neutral-700">{fd(q.fechaPlan)}</span></div>
              <div className="pl-3 text-base font-extrabold tabular-nums">{clp(q.r ? q.r.neto : q.neto)}</div>
              <div className="pl-3 text-xs text-neutral-700">neto · {condL(q.cond)}</div>
              <span className={`badge ml-3 self-start ${cls}`}>{q.est}</span>
              {q.r && <button type="button" className="btn btn-ghost ml-3 justify-start text-xs" onClick={() => { close(); openDrawer(q.r!.folio); }}>Folio {q.r.folio}</button>}
              {!q.r && canEdit && q.n === nextEmit && <button type="button" className="btn btn-primary ml-3 self-start !px-2.5 !py-1.5 text-xs" onClick={() => openModal({ type: "factura", init: { mode: "cuota", planId: p.id, n: q.n } })}>Emitir cuota</button>}
            </div>
          );
        })}
      </div>
    </Dlg>
  );
}

// ───────────────────────── Correo de cobranza + estado de cuenta ─────────────────────────
export function CorreoModal({ clientId }: { clientId: string }) {
  const { d, cmap, snap, today, openModal, run, busy, user } = useApp();
  const c = cmap[clientId];
  const rows = d.rows.filter((r) => r.clientId === clientId && r.saldo > 0);
  const tot = rows.reduce((a, r) => a + r.saldo, 0);
  const ct = c.contacts.find((x) => x.pagos && !x.incorrecto) ?? { nombre: c.contact.name, email: c.contact.email };
  const [f, setF] = useState({ para: ct.email, asunto: `Estado de cuenta ${sn(c.name)} al ${fd(today)} · Comercializadora DMC`, cuerpo: fillTemplate(snap.config.emailTpl, { contacto: ct.nombre, cliente: c.name, fecha: fd(today), monto: clp(tot), folios: rows.map((r) => r.folio).join(", "), usuario: user.name }) });
  const [err, setErr] = useState("");
  const close = () => openModal(null);
  const send = async () => {
    const res = await run(sendCorreoCobranza({ clientId, ...f }));
    if (res.ok) close(); else setErr(res.fieldErrors?.para ?? "");
  };
  return (
    <Dlg onClose={close} kicker="Plantilla editable" title="Enviar correo de cobranza" width={640}
      footer={<><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="button" className="btn btn-primary" disabled={busy} onClick={send}><Send size={14} aria-hidden />Enviar</button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Para" error={err}><input className="input" type="email" value={f.para} maxLength={120} onChange={(e) => { setF({ ...f, para: e.target.value }); setErr(""); }} /></Field>
        <Field label="Asunto"><input className="input" value={f.asunto} maxLength={200} onChange={(e) => setF({ ...f, asunto: e.target.value })} /></Field>
        <Field label="Mensaje"><textarea className="input !min-h-[220px] leading-normal" maxLength={4000} value={f.cuerpo} onChange={(e) => setF({ ...f, cuerpo: e.target.value })} /></Field>
        <div className="flex items-center gap-2 text-[13px]"><span className="tag tag-accent !px-2.5 !py-1.5"><Paperclip size={14} aria-hidden />Estado_de_cuenta_{sn(c.name).replace(/\W+/g, "_")}.pdf</span>
          <button type="button" className="btn btn-ghost text-xs" onClick={() => openModal({ type: "edo", clientId })}>Ver estado de cuenta</button></div>
      </div>
    </Dlg>
  );
}

export function EdoModal({ clientId }: { clientId: string }) {
  const { d, cmap, today, openModal, canEdit } = useApp();
  const c = cmap[clientId];
  const rows = d.rows.filter((r) => r.clientId === clientId && r.saldo > 0).sort((a, b) => (a.venc < b.venc ? -1 : 1));
  const total = rows.reduce((a, r) => a + r.saldo, 0);
  const ct = c.contacts.find((x) => x.pagos && !x.incorrecto);
  const close = () => openModal(null);
  return (
    <Dlg onClose={close} kicker="Vista previa" title={`Estado de cuenta · ${sn(c.name)}`} width={820}
      footer={<>
        <a className="btn btn-secondary" href={`/api/pdf/estado-cuenta/${clientId}`} target="_blank" rel="noopener"><Download size={14} aria-hidden />Descargar PDF</a>
        {canEdit && <button type="button" className="btn btn-primary" onClick={() => openModal({ type: "correo", clientId })}><Mail size={14} aria-hidden />Enviar correo de cobranza</button>}
      </>}>
      <div className="bg-white p-8 text-ink shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div><div className="text-[30px] font-extrabold leading-none tracking-[-0.05em]"><span className="text-accent">d</span>MC</div><div className="mt-2 text-xs leading-normal">Comercializadora DMC SpA<br />RUT 76.543.210-K · Santiago<br />facturacion@grupodmc.example</div></div>
          <div className="text-right"><div className="text-2xl font-extrabold">Estado de cuenta</div><div className="text-[13px]">al {fd(today)}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-b border-divider py-5 text-[13px]">
          <div><div className="kpi-label">Cliente</div><div className="text-[15px] font-extrabold">{c.name}</div><div>RUT {c.rut}</div><div>{c.address}</div></div>
          <div><div className="kpi-label">Contacto de pago</div><div className="font-semibold">{ct?.nombre ?? c.contact.name}</div><div>{ct?.email ?? c.contact.email} · {ct?.tel ?? c.contact.phone}</div></div>
        </div>
        <div className="overflow-x-auto"><table className="tbl mt-4 !text-xs">
          <thead><tr><th>Folio</th><th>Emisión</th><th>Vence</th><th>Referencia</th><th className="r">Días vencida</th><th className="r">Total</th><th className="r">Abonos</th><th className="r">Saldo</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.folio}><td className="font-bold">{r.folio}</td><td>{fd(r.emision)}</td><td>{fd(r.venc)}</td><td>{r.refs.find((x) => x.tipo === "OC cliente")?.num ?? r.refs[0]?.num ?? "—"}</td><td className="r">{r.dias < 0 ? -r.dias : "—"}</td><td className="r">{clp(r.total)}</td><td className="r">{clp(r.paid)}</td><td className="r font-bold">{clp(r.saldo)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={7} className="!bg-transparent">Total adeudado</td><td className="r !bg-transparent text-base !text-accent-700">{clp(total)}</td></tr></tfoot>
        </table></div>
        {!rows.length && <p className="py-6 text-sm text-neutral-700">Este cliente no tiene facturas con saldo.</p>}
        <p className="mt-8 border-t border-divider pt-3 text-xs leading-relaxed text-neutral-700">Transferir a Comercializadora DMC SpA · Banco de Chile · Cta. Cte. 00-123-45678-09 (datos de ejemplo) · enviar comprobante a facturacion@grupodmc.example indicando N° de folio.</p>
      </div>
    </Dlg>
  );
}

// ───────────────────────── OC / cotización / HEP ─────────────────────────
export function RefModal({ tipo, num }: { tipo: string; num: string }) {
  const { d, cmap, openModal, openDrawer } = useApp();
  const rows = d.rows.filter((r) => r.refs.some((x) => x.tipo === tipo && x.num === num));
  const monto = rows.filter((r) => !r.anulada).reduce((a, r) => a + r.total, 0);
  const saldo = rows.reduce((a, r) => a + r.saldo, 0);
  const close = () => openModal(null);
  return (
    <Dlg onClose={close} kicker={`${tipo}${rows[0] ? " · " + sn(cmap[rows[0].clientId]?.name) : ""}`} title={num} width={640}
      footer={<button type="button" className="btn btn-secondary" onClick={close}>Cerrar</button>}>
      <div className="grid grid-cols-3 border-t-2 border-ink">
        {[["Facturas", String(rows.length)], ["Facturado", clp(monto)], ["Saldo", clp(saldo)]].map(([l, v], i) => <div key={l} className="cell p-2.5" style={{ background: "var(--color-surface)" }}><div className="text-[11px] text-neutral-700">{l}</div><div className={`font-extrabold tabular-nums ${i === 2 ? "text-accent-700" : ""}`}>{v}</div></div>)}
      </div>
      <div className="mt-3">
        {rows.map((r) => (
          <button key={r.folio} type="button" onClick={() => { close(); openDrawer(r.folio); }} className="grid w-full grid-cols-[70px_90px_1fr_auto_auto] items-center gap-3 border-0 border-b border-neutral-300 bg-transparent py-2.5 text-left text-[13px] hover:bg-accent-100">
            <b className="tabular-nums">{r.folio}</b><span className="tabular-nums">{fd(r.emision)}</span><span>{r.servicio}</span><StatusBadge status={r.status} /><span className="min-w-[110px] text-right font-bold tabular-nums">{clp(r.total)}</span>
          </button>
        ))}
        {!rows.length && <p className="py-4 text-sm text-neutral-700">Aún no hay facturas con esta referencia. <Link href="/ordenes-de-compra">Ver OC sin factura</Link>.</p>}
      </div>
    </Dlg>
  );
}
