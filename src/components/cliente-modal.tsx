"use client";
import { useState } from "react";
import { useApp } from "./app-context";
import { Dlg, Field } from "./ui";
import { rutState } from "@/lib/domain";
import { createClient } from "@/server/actions";

/** Alta rápida de cliente; queda "por validar" hasta homologar con la BD core. */
export function ClienteModal({ initialRut = "", onClose, onCreated }: { initialRut?: string; onClose: () => void; onCreated?: (id: string) => void }) {
  const { snap, run, busy } = useApp();
  const [f, setF] = useState({ razon: "", rut: initialRut, giro: "", cond: "30", cnombre: "", ctel: "", cemail: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF((s) => ({ ...s, [k]: e.target.value })); setErr((x) => ({ ...x, [k]: "" })); };
  const rs = f.rut.length > 2 ? rutState(f.rut) : null;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.razon.trim()) e.razon = "Requerido";
    if (!rutState(f.rut).ok) e.rut = rutState(f.rut).msg || "RUT inválido";
    if (Object.keys(e).length) return setErr(e);
    const res = await run(createClient({ ...f, cond: +f.cond }));
    if (res.ok) onCreated ? onCreated((res.data as { id: string }).id) : onClose();
    else if (res.fieldErrors) setErr(res.fieldErrors);
  };

  return (
    <Dlg onClose={onClose} kicker="Alta rápida" title="Cliente nuevo" width={560}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>Crear cliente</button></>}>
      <div className="mb-4 px-3 py-2.5 text-[13px]" style={{ background: "var(--color-warn-bg)", color: "var(--color-warn)" }}>Quedará <b>por validar</b> hasta que se homologue con la BD core DMC Clientes.</div>
      <div className="grid grid-cols-2 gap-3">
        <Field className="col-span-full" label="Razón social" error={err.razon}><input className="input" value={f.razon} maxLength={120} aria-invalid={!!err.razon || undefined} onChange={set("razon")} autoFocus /></Field>
        <Field label="RUT" error={err.rut || (rs && !rs.ok ? rs.msg : "")} hint={rs?.ok ? <span className="text-good">RUT válido</span> : undefined}>
          <input className="input tabular-nums" value={f.rut} placeholder="76.123.456-7" maxLength={15} aria-invalid={!!err.rut || undefined} onChange={set("rut")} />
        </Field>
        <Field label="Condición de pago"><select className="input" value={f.cond} onChange={set("cond")}>{snap.config.catalogs.conds.map((c) => <option key={c} value={c}>{c === 0 ? "Contado" : `Crédito ${c} días`}</option>)}</select></Field>
        <Field className="col-span-full" label="Giro"><input className="input" value={f.giro} maxLength={80} onChange={set("giro")} /></Field>
        <Field label="Contacto de pago"><input className="input" value={f.cnombre} maxLength={80} placeholder="Nombre" onChange={set("cnombre")} /></Field>
        <Field label="Teléfono"><input className="input" value={f.ctel} maxLength={30} placeholder="+56 9 …" onChange={set("ctel")} /></Field>
        <Field className="col-span-full" label="Correo" error={err.cemail}><input className="input" type="email" value={f.cemail} maxLength={120} placeholder="pagos@empresa.cl" onChange={set("cemail")} /></Field>
      </div>
    </Dlg>
  );
}
