import { z } from "zod";
import { isIsoDate } from "./domain";

/** Mensajes en español para los errores más comunes de Zod. */
z.config({
  customError: (iss) => {
    if (iss.code === "too_small" && iss.origin === "string") return "Requerido";
    if (iss.code === "too_big" && iss.origin === "string") return "Demasiado largo";
    if (iss.code === "invalid_type") return "Valor inválido";
    return undefined;
  },
});

const text = (max: number) => z.string().trim().max(max);
const reqText = (max: number) => z.string().trim().min(1).max(max);
export const isoDate = z.string().refine(isIsoDate, "Fecha inválida");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const money = z.number().int("Debe ser entero").positive("Debe ser mayor que 0").max(2_000_000_000, "Monto demasiado alto");
const email = z.string().trim().max(120).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Correo inválido");

export const fileMeta = z.object({
  name: reqText(160),
  size: text(20).optional(),
  kind: text(30).optional(),
});

const refSchema = z.object({
  tipo: z.enum(["Cotización DMC", "OC cliente", "HEP"]),
  num: text(40),
});

export const loginSchema = z.object({
  user: reqText(80),
  password: z.string().min(1).max(200),
});

export const invoiceSchema = z.object({
  orig: z.number().int().positive().optional(),
  folio: z.number().int("Folio inválido").positive("Folio inválido").max(99_999_999),
  emision: isoDate,
  clientId: reqText(40),
  sucursal: text(120),
  servicio: reqText(60),
  neto: money,
  cond: z.number().int().min(0).max(365),
  /** Solo si el usuario corrigió el vencimiento a mano. */
  vencManual: isoDate.optional(),
  refs: z.array(refSchema).max(12),
  files: z.array(fileMeta).max(12),
  obs: text(1000),
  cuotas: z.array(z.object({ neto: money, cond: z.number().int().min(0).max(365) })).min(2).max(12).optional(),
  /** Emisión de una cuota de un plan existente. */
  planRef: z.object({ id: reqText(20), n: z.number().int().positive() }).optional(),
  force: z.boolean().optional(),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const sheetSchema = z.object({
  rows: z
    .array(
      z.object({
        folio: z.number().int().positive().max(99_999_999),
        emision: isoDate,
        clientId: reqText(40),
        sucursal: text(120),
        servicio: reqText(60),
        neto: money,
        cond: z.number().int().min(0).max(365),
        cot: text(30),
        oc: text(40),
      }),
    )
    .min(1)
    .max(100),
});

export const paymentSchema = z.object({
  folio: z.number().int().positive(),
  fecha: isoDate,
  monto: money,
  medio: reqText(40),
  recibidoPor: reqText(60),
  comp: text(40),
  nota: text(300),
  file: fileMeta.nullable(),
});

export const bulkPaySchema = z.object({
  folios: z.array(z.number().int().positive()).min(1).max(200),
  fecha: isoDate,
});
export const bulkEnvioSchema = z.object({ folios: z.array(z.number().int().positive()).min(1).max(200) });

export const anularSchema = z.object({
  folio: z.number().int().positive(),
  nc: z.number().int().positive().max(99_999_999),
  ncFecha: isoDate,
  motivo: reqText(80),
  detalle: text(500),
  file: fileMeta,
});

export const gestionSchema = z.object({
  folios: z.array(z.number().int().positive()).min(1, "Selecciona al menos una factura").max(60),
  clientId: reqText(40),
  canal: z.enum(["Correo", "WhatsApp", "Otros contactos", "Llamada"]),
  contactoId: text(60),
  fecha: isoDate,
  hora: hhmm,
  resultado: reqText(1000),
  compromiso: z.object({ fecha: isoDate, hora: hhmm, monto: money, texto: text(200) }).nullable(),
});

export const envioSchema = z.object({
  folio: z.number().int().positive(),
  canal: z.enum(["Correo", "Portal Walmart", "WhatsApp"]),
  para: email,
  asunto: text(200),
  cuerpo: text(4000),
  ck1: z.boolean().optional(),
  ck2: z.boolean().optional(),
});

export const correoCobranzaSchema = z.object({
  clientId: reqText(40),
  para: z.string().trim().min(1).max(120).pipe(z.email("Correo inválido")),
  asunto: text(200),
  cuerpo: text(4000),
});

export const clientSchema = z.object({
  razon: reqText(120),
  rut: reqText(15),
  giro: text(80),
  cond: z.number().int().min(0).max(365),
  cnombre: text(80),
  cemail: email,
  ctel: text(30),
});

export const contactSchema = z.object({
  clientId: reqText(40),
  nombre: reqText(80),
  cargo: text(80),
  email,
  tel: text(30),
});
export const contactFlagSchema = z.object({
  clientId: reqText(40),
  contactId: reqText(60),
  field: z.enum(["pagos", "incorrecto"]),
  value: z.boolean(),
});
export const clientRuleSchema = z.object({ clientId: reqText(40), rule: z.enum(["exigeOC", "unaOC", "hep"]), value: z.boolean() });

export const holidaySchema = z.object({ f: isoDate, n: reqText(80) });
export const metasSchema = z.object({
  metas: z.array(z.number().int().min(0).max(5_000_000_000)).length(12),
  minimos: z.array(z.number().int().min(0).max(5_000_000_000)).length(12),
});
export const catalogSchema = z.object({
  key: z.enum(["services", "medios", "conds", "recibidos", "motivosNC"]),
  value: reqText(60),
});
export const templatesSchema = z.object({ emailTpl: reqText(4000), envioTpl: reqText(4000) });
export const userUpdateSchema = z.object({
  id: reqText(20),
  role: z.enum(["fact", "ger", "admin"]).optional(),
  active: z.boolean().optional(),
});

/** Aplana los errores de Zod a `{ campo: mensaje }`. */
export function flatErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_";
    if (!(k in out)) out[k] = i.message;
  }
  return out;
}
