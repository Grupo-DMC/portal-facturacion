"use server";

import {
  anularSchema, bulkEnvioSchema, bulkPaySchema, catalogSchema, clientRuleSchema, clientSchema, contactFlagSchema, contactSchema,
  correoCobranzaSchema, envioSchema, gestionSchema, holidaySchema, invoiceSchema, metasSchema, paymentSchema, sheetSchema,
  templatesSchema, userUpdateSchema,
} from "@/lib/schemas";
import { z } from "zod";
import { addDays, calcIva, calcVenc, derive, holidaySet, rutState } from "@/lib/domain";
import { clp, fd, safeFileName, sn } from "@/lib/format";
import type { ActionResult, Client, FileMeta, Invoice, Plan, Ref, SessionUser } from "@/lib/types";
import { ADMIN, err, guard, ok, userShort, WRITE_ROLES } from "./guard";
import { data, getToday } from "./store";

type R = ActionResult;
const W = WRITE_ROLES;
const today = () => getToday();
const ev = (i: Invoice, u: SessionUser, text: string) => i.events.push({ fecha: today(), user: userShort(u), text });
const findInv = (folio: number) => data().invoices.find((i) => i.folio === folio);
const findClient = (id: string) => data().clients.find((c) => c.id === id);
const cleanFile = (f: FileMeta | null): FileMeta | null => (f ? { name: safeFileName(f.name), size: f.size?.slice(0, 20), kind: f.kind?.slice(0, 30) } : null);
const hs = () => holidaySet(data().config);
const sumPaid = (i: Invoice) => i.payments.reduce((a, p) => a + p.monto, 0);

function dedupeRefs(c: Client, refs: Ref[]): Ref[] {
  const seen = new Set<string>();
  let ocs = 0;
  return refs
    .map((r) => ({ tipo: r.tipo, num: r.num.trim() }))
    .filter((r) => r.num)
    .filter((r) => {
      const k = r.tipo + "|" + r.num.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      if (r.tipo === "OC cliente" && c.unaOC && ++ocs > 1) return false;
      return true;
    });
}

// ───────────────────────── Facturas ─────────────────────────
export async function saveInvoice(input: unknown): Promise<ActionResult<{ folio: number }>> {
  return guard(W, invoiceSchema, input, (f, user) => {
    const d = data();
    const T = today();
    const fe: Record<string, string> = {};
    const c = findClient(f.clientId);
    if (!c) fe.clientId = "Receptor no encontrado";
    if (!d.config.catalogs.services.includes(f.servicio)) fe.servicio = "Servicio no válido";
    if (f.emision > T) fe.emision = "La emisión no puede ser futura";
    if (d.invoices.some((i) => i.folio === f.folio && i.folio !== f.orig)) fe.folio = `El folio ${f.folio} ya existe`;
    if (f.cuotas && f.cuotas.reduce((a, q) => a + q.neto, 0) !== f.neto) fe.neto = "Las cuotas deben sumar el neto";
    if (f.vencManual && f.vencManual < f.emision) fe.venc = "El vencimiento no puede ser anterior a la emisión";
    if (Object.keys(fe).length || !c) return err("Revisa los campos marcados.", fe);

    const refs = dedupeRefs(c, f.refs);
    if (c.exigeOC && !refs.some((r) => r.tipo === "OC cliente") && !f.force) return err("Este cliente exige OC.", { _warnOC: "1" });

    const first = f.cuotas ? f.cuotas[0] : null;
    const netoF = first ? first.neto : f.neto;
    const cond = first ? first.cond : f.cond;
    const vv = f.vencManual && !first ? { venc: f.vencManual, raw: f.vencManual } : calcVenc(f.emision, cond, hs());
    const iva = calcIva(netoF);
    const files = f.files.length
      ? f.files.map((x) => cleanFile(x)!)
      : [{ name: `Factura_${f.folio}.pdf`, size: "84 KB", kind: "Factura" }, { name: `DTE_${f.folio}.xml`, size: "12 KB", kind: "XML" }];
    const base = { folio: f.folio, emision: f.emision, clientId: f.clientId, sucursal: f.sucursal, servicio: f.servicio, neto: netoF, iva, total: netoF + iva, cond, venc: vv.venc, vencRaw: vv.raw, refs, files, obs: f.obs };

    if (f.orig) {
      const inv = findInv(f.orig);
      if (!inv) return err("La factura no existe.");
      if (inv.anulada) return err("Una factura anulada no se puede editar.");
      if (base.total < sumPaid(inv)) return err("El total no puede ser menor a lo ya pagado.", { neto: "Menor a lo ya pagado" });
      Object.assign(inv, base);
      ev(inv, user, "Factura editada");
      return ok(`Factura ${f.folio} actualizada`, { folio: f.folio });
    }

    let plan: Invoice["plan"] = null;
    if (f.planRef) {
      const p = d.plans.find((x) => x.id === f.planRef!.id);
      const q = p?.cuotas.find((x) => x.n === f.planRef!.n);
      if (!p || !q) return err("El plan o la cuota no existe.");
      if (q.folio) return err("Esa cuota ya fue emitida.");
      q.folio = f.folio;
      plan = { id: p.id, n: q.n, of: p.cuotas.length };
    } else if (f.cuotas) {
      const id = "PL-" + String(d.plans.length + 1).padStart(3, "0");
      const N = f.cuotas.length;
      plan = { id, n: 1, of: N };
      const np: Plan = {
        id, clientId: f.clientId, nombre: `${sn(c.name)} – ${f.servicio} en ${N} cuotas`, tipo: "cuotas", servicio: f.servicio, sucursal: f.sucursal, refs,
        cuotas: f.cuotas.map((q, i) => ({ n: i + 1, neto: q.neto, cond: q.cond, folio: i === 0 ? f.folio : null, fechaPlan: addDays(f.emision, 30 * i) })),
      };
      d.plans.push(np);
    }
    const inv: Invoice = {
      ...base, payments: [], gestiones: [], anulada: false, nc: null, envio: { estado: "No enviada" }, plan,
      events: [{ fecha: T, user: userShort(user), text: "Factura creada" + (plan ? ` · cuota ${plan.n}/${plan.of}` : "") }],
    };
    d.invoices.unshift(inv);
    const msg = f.cuotas ? `Cuota 1/${f.cuotas.length} emitida (folio ${f.folio}) · ${f.cuotas.length - 1} cuotas quedan por emitir` : `Factura ${f.folio} creada · ${clp(netoF + iva)}`;
    return ok(msg, { folio: f.folio });
  });
}

export async function saveSheet(input: unknown): Promise<R> {
  return guard(W, sheetSchema, input, (f, user) => {
    const d = data();
    const T = today();
    const ex = new Set(d.invoices.map((i) => i.folio));
    const bad: number[] = [];
    const made: Invoice[] = [];
    f.rows.forEach((r, i) => {
      const c = findClient(r.clientId);
      if (!c || ex.has(r.folio) || r.emision > T || !d.config.catalogs.services.includes(r.servicio)) return void bad.push(i + 1);
      ex.add(r.folio);
      const vv = calcVenc(r.emision, r.cond, hs());
      const refs: Ref[] = [];
      if (r.cot) refs.push({ tipo: "Cotización DMC", num: /^COT/i.test(r.cot) ? r.cot.toUpperCase() : "COT-" + r.cot });
      if (r.oc) refs.push({ tipo: "OC cliente", num: r.oc });
      const iva = calcIva(r.neto);
      made.push({
        folio: r.folio, emision: r.emision, clientId: r.clientId, sucursal: r.sucursal, servicio: r.servicio, neto: r.neto, iva, total: r.neto + iva,
        cond: r.cond, venc: vv.venc, vencRaw: vv.raw, refs, obs: "", payments: [], gestiones: [], anulada: false, nc: null, envio: { estado: "No enviada" }, plan: null,
        files: [{ name: `Factura_${r.folio}.pdf`, size: "84 KB", kind: "Factura" }, { name: `DTE_${r.folio}.xml`, size: "12 KB", kind: "XML" }],
        events: [{ fecha: T, user: userShort(user), text: "Factura creada (modo planilla)" }],
      });
    });
    if (bad.length) return err(`Revisa las filas ${bad.join(", ")}: folio único, receptor, servicio y neto son obligatorios`);
    d.invoices.unshift(...made);
    d.invoices.sort((a, b) => b.folio - a.folio);
    return ok(`${made.length} facturas guardadas`);
  });
}

// ───────────────────────── Pagos ─────────────────────────
export async function registerPayment(input: unknown): Promise<R> {
  return guard(W, paymentSchema, input, (f, user) => {
    const d = data();
    const inv = findInv(f.folio);
    if (!inv || inv.anulada) return err("La factura no admite pagos.");
    const saldo = Math.max(0, inv.total - sumPaid(inv));
    const fe: Record<string, string> = {};
    if (f.monto > saldo) fe.monto = `Supera el saldo (${clp(saldo)})`;
    if (f.fecha > today()) fe.fecha = "La fecha no puede ser futura";
    if (f.fecha < inv.emision) fe.fecha = "Es anterior a la emisión de la factura";
    if (!d.config.catalogs.medios.includes(f.medio)) fe.medio = "Medio no válido";
    if (!d.config.catalogs.recibidos.includes(f.recibidoPor)) fe.recibidoPor = "Valor no válido";
    if (Object.keys(fe).length) return err("Revisa los campos marcados.", fe);
    inv.payments.push({ id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: f.fecha, monto: f.monto, medio: f.medio, comp: f.comp, nota: f.nota, recibidoPor: f.recibidoPor, file: cleanFile(f.file) });
    ev(inv, user, `Pago registrado ${clp(f.monto)} · ${f.medio} · recibido por ${f.recibidoPor}`);
    return ok(f.monto === saldo ? `Factura ${f.folio} pagada · pasó sola a Pagadas` : `Abono de ${clp(f.monto)} registrado · saldo ${clp(saldo - f.monto)}`);
  });
}

export async function bulkPay(input: unknown): Promise<R> {
  return guard(W, bulkPaySchema, input, (f, user) => {
    if (f.fecha > today()) return err("La fecha no puede ser futura.", { fecha: "Fecha futura" });
    let n = 0;
    for (const folio of new Set(f.folios)) {
      const inv = findInv(folio);
      if (!inv || inv.anulada || f.fecha < inv.emision) continue;
      const saldo = inv.total - sumPaid(inv);
      if (saldo <= 0) continue;
      inv.payments.push({ id: "p" + Date.now().toString(36) + n, fecha: f.fecha, monto: saldo, medio: "Transferencia", comp: "", nota: "Pago masivo", recibidoPor: "Facturación", file: null });
      ev(inv, user, `Pago registrado ${clp(saldo)} · Transferencia · pago masivo`);
      n++;
    }
    return n ? ok(`${n} facturas marcadas como pagadas`) : err("Ninguna de las seleccionadas admite pago en esa fecha.");
  });
}

// ───────────────────────── Anulación con NC ─────────────────────────
export async function anularFactura(input: unknown): Promise<R> {
  return guard(W, anularSchema, input, (f, user) => {
    const d = data();
    const inv = findInv(f.folio);
    if (!inv) return err("La factura no existe.");
    if (inv.anulada) return err("La factura ya está anulada.");
    const fe: Record<string, string> = {};
    if (d.invoices.some((i) => i.nc && +i.nc.num === f.nc)) fe.nc = `La NC ${f.nc} ya existe`;
    if (!d.config.catalogs.motivosNC.includes(f.motivo)) fe.motivo = "Motivo no válido";
    if (f.motivo === "Otro" && !f.detalle) fe.detalle = "Describe el motivo";
    if (f.ncFecha > today()) fe.ncFecha = "La fecha no puede ser futura";
    if (!/\.pdf$/i.test(f.file.name)) fe.file = "Debe ser un PDF";
    if (Object.keys(fe).length) return err("Revisa los campos marcados.", fe);
    inv.anulada = true;
    inv.nc = { num: String(f.nc), fecha: f.ncFecha, motivo: f.motivo, detalle: f.detalle, file: cleanFile(f.file)! };
    d.ncNext = Math.max(d.ncNext, f.nc + 1);
    ev(inv, user, `Factura anulada · NC ${f.nc} · ${f.motivo}`);
    return ok(`Factura ${f.folio} anulada con NC ${f.nc} · no suma a los totales`);
  });
}

// ───────────────────────── Cobranza ─────────────────────────
export async function registerGestion(input: unknown): Promise<R> {
  return guard(W, gestionSchema, input, (f, user) => {
    const c = findClient(f.clientId);
    if (!c) return err("Cliente no encontrado.");
    const invs = [...new Set(f.folios)].map(findInv);
    if (invs.some((i) => !i || i.clientId !== f.clientId || i.anulada)) return err("Hay facturas que no corresponden al cliente.");
    if (f.fecha > today()) return err("La fecha no puede ser futura.", { fecha: "Fecha futura" });
    const ct = c.contacts.find((x) => x.id === f.contactoId);
    const ctL = ct ? ct.nombre + (ct.cargo ? ` (${ct.cargo})` : "") : "—";
    const folios = invs.map((i) => i!.folio);
    invs.forEach((inv, k) => {
      inv!.gestiones.push({
        fecha: f.fecha, hora: f.hora, canal: f.canal, contacto: ctL, user: userShort(user),
        resultado: f.resultado + (folios.length > 1 ? ` (folios ${folios.join(", ")})` : ""),
        compromiso: k === 0 ? f.compromiso : null,
      });
      ev(inv!, user, `Gestión de cobranza · ${f.canal} · ${ctL}` + (k === 0 && f.compromiso ? ` · compromiso ${fd(f.compromiso.fecha)} ${f.compromiso.hora}` : ""));
    });
    return ok(`Gestión por ${f.canal.toLowerCase()} registrada` + (f.compromiso ? ` · compromiso ${fd(f.compromiso.fecha)} ${f.compromiso.hora}` : ""));
  });
}

export async function sendCorreoCobranza(input: unknown): Promise<R> {
  return guard(W, correoCobranzaSchema, input, (f, user) => {
    const c = findClient(f.clientId);
    if (!c) return err("Cliente no encontrado.");
    // Aquí iría el envío SMTP real; el mock solo registra la gestión.
    const { rows } = derive({ ...snapshotLite() });
    rows.filter((r) => r.clientId === f.clientId && r.status === "En cobranza").forEach((r) => {
      const inv = findInv(r.folio)!;
      inv.gestiones.push({ fecha: today(), hora: nowHM(), canal: "Correo", contacto: f.para, resultado: "Enviado estado de cuenta por correo.", compromiso: null, user: userShort(user) });
      ev(inv, user, `Gestión de cobranza · Correo · ${f.para}`);
    });
    return ok(`Correo enviado a ${f.para} con estado de cuenta adjunto`);
  });
}

// ───────────────────────── Envío de factura ─────────────────────────
export async function sendEnvio(input: unknown): Promise<R> {
  return guard(W, envioSchema, input, (f, user) => {
    const inv = findInv(f.folio);
    if (!inv || inv.anulada) return err("La factura no admite envío.");
    if (f.canal === "Correo" && !/@/.test(f.para)) return err("Correo inválido.", { para: "Correo inválido" });
    if (f.canal === "Portal Walmart" && !(f.ck1 && f.ck2)) return err("Confirma que subiste el PDF y el XML al portal.", { ck: "Confirma PDF y XML" });
    inv.envio = { estado: "Enviada", fecha: today(), canal: f.canal };
    ev(inv, user, `Factura enviada al cliente · ${f.canal}` + (f.canal === "Correo" ? ` · ${f.para}` : ""));
    return ok(`Factura ${f.folio} enviada · ${f.canal}`);
  });
}

export async function bulkEnvio(input: unknown): Promise<R> {
  return guard(W, bulkEnvioSchema, input, (f, user) => {
    let n = 0;
    for (const folio of new Set(f.folios)) {
      const inv = findInv(folio);
      if (!inv || inv.anulada || inv.envio.estado === "Enviada") continue;
      const c = findClient(inv.clientId);
      inv.envio = { estado: "Enviada", fecha: today(), canal: c?.hep ? "Portal Walmart" : "Correo" };
      ev(inv, user, `Factura enviada al cliente · ${inv.envio.canal}`);
      n++;
    }
    return n ? ok(`${n} facturas marcadas como enviadas`) : err("Ninguna de las seleccionadas está pendiente de envío.");
  });
}

// ───────────────────────── Clientes ─────────────────────────
export async function createClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guard(W, clientSchema, input, (f) => {
    const d = data();
    const r = rutState(f.rut);
    const fe: Record<string, string> = {};
    if (!r.ok) fe.rut = r.msg || "RUT inválido";
    else if (d.clients.some((c) => c.rut === r.fmt)) fe.rut = "Ya existe un cliente con ese RUT";
    if (Object.keys(fe).length) return err("Revisa los campos marcados.", fe) as ActionResult<{ id: string }>;
    const id = "n" + Date.now().toString(36);
    d.clients.push({
      id, name: f.razon, rut: r.fmt, giro: f.giro || "—", address: "—", branches: [], cond: f.cond,
      contact: { name: f.cnombre, email: f.cemail, phone: f.ctel },
      contacts: f.cnombre ? [{ id: id + "-1", nombre: f.cnombre, cargo: "Encargado/a de pagos", email: f.cemail, tel: f.ctel, pagos: true, incorrecto: false }] : [],
      origin: "local", exigeOC: false, unaOC: false, hep: false,
    });
    return ok("Cliente creado · queda “por validar” con el core", { id });
  });
}

export async function addContact(input: unknown): Promise<R> {
  return guard(W, contactSchema, input, (f) => {
    const c = findClient(f.clientId);
    if (!c) return err("Cliente no encontrado.");
    c.contacts.push({ id: c.id + "-" + Date.now().toString(36), nombre: f.nombre, cargo: f.cargo, email: f.email, tel: f.tel, pagos: false, incorrecto: false });
    return ok("Contacto agregado");
  });
}

export async function setContactFlag(input: unknown): Promise<R> {
  return guard(W, contactFlagSchema, input, (f) => {
    const ct = findClient(f.clientId)?.contacts.find((x) => x.id === f.contactId);
    if (!ct) return err("Contacto no encontrado.");
    ct[f.field] = f.value;
    return ok();
  });
}

export async function setClientRule(input: unknown): Promise<R> {
  return guard(W, clientRuleSchema, input, (f) => {
    const c = findClient(f.clientId);
    if (!c) return err("Cliente no encontrado.");
    c[f.rule] = f.value;
    return ok("Regla actualizada");
  });
}

export async function homologarClient(input: unknown): Promise<R> {
  return guard(W, z.object({ clientId: z.string().min(1).max(40) }), input, (f) => {
    const c = findClient(f.clientId);
    if (!c) return err("Cliente no encontrado.");
    c.origin = "core";
    return ok(`${sn(c.name)} homologado con la BD core`);
  });
}

// ───────────────────────── Configuración (solo Administrador) ─────────────────────────
export async function addHoliday(input: unknown): Promise<R> {
  return guard(ADMIN, holidaySchema, input, (f) => {
    const hl = data().config.holidays;
    if (hl.some((h) => h.f === f.f)) return err("Esa fecha ya está en el calendario.", { f: "Duplicado" });
    hl.push({ f: f.f, n: f.n });
    hl.sort((a, b) => (a.f < b.f ? -1 : 1));
    return ok("Feriado agregado · aplica a facturas nuevas");
  });
}
export async function removeHoliday(input: unknown): Promise<R> {
  return guard(ADMIN, z.object({ f: z.string().min(8).max(10) }), input, (f) => {
    const cfg = data().config;
    cfg.holidays = cfg.holidays.filter((h) => h.f !== f.f);
    return ok("Feriado quitado");
  });
}
export async function saveMetas(input: unknown): Promise<R> {
  return guard(ADMIN, metasSchema, input, (f) => {
    if (f.metas.some((m, i) => m < f.minimos[i])) return err("La meta no puede ser menor que el mínimo.");
    Object.assign(data().config, { metas: f.metas, minimos: f.minimos });
    return ok("Metas guardadas");
  });
}
export async function addCatalogItem(input: unknown): Promise<R> {
  return guard(ADMIN, catalogSchema, input, (f) => {
    const cat = data().config.catalogs;
    if (f.key === "conds") {
      const n = Number(f.value);
      if (!Number.isInteger(n) || n < 0 || n > 365) return err("Ingresa días entre 0 y 365.");
      if (cat.conds.includes(n)) return err("Ya existe.");
      cat.conds.push(n);
      cat.conds.sort((a, b) => a - b);
    } else {
      if (cat[f.key].some((x) => x.toLowerCase() === f.value.toLowerCase())) return err("Ya existe.");
      cat[f.key].push(f.value);
    }
    return ok("Agregado al catálogo");
  });
}
export async function removeCatalogItem(input: unknown): Promise<R> {
  return guard(ADMIN, catalogSchema, input, (f) => {
    const cat = data().config.catalogs;
    if (f.key === "conds") cat.conds = cat.conds.filter((x) => String(x) !== f.value);
    else cat[f.key] = cat[f.key].filter((x) => x !== f.value);
    return ok("Quitado del catálogo");
  });
}
export async function saveTemplates(input: unknown): Promise<R> {
  return guard(ADMIN, templatesSchema, input, (f) => {
    Object.assign(data().config, f);
    return ok("Plantillas guardadas");
  });
}
export async function updateUser(input: unknown): Promise<R> {
  return guard(ADMIN, userUpdateSchema, input, (f, me) => {
    const u = data().users.find((x) => x.id === f.id);
    if (!u) return err("Usuario no encontrado.");
    if (u.id === me.id && (f.active === false || (f.role && f.role !== "admin"))) return err("No puedes quitarte tu propio acceso de administrador.");
    if (f.role) u.role = f.role;
    if (f.active !== undefined) u.active = f.active;
    return ok(`${u.name} actualizado`);
  });
}

// ───────────────────────── util interno ─────────────────────────
function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function snapshotLite() {
  const d = data();
  return { invoices: d.invoices, clients: d.clients, config: d.config, today: today() };
}
