export const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MESL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

export const clp = (n: number | null | undefined) => "$ " + nf.format(Math.round(n || 0));
export const num = (n: number | null | undefined) => nf.format(Math.round(n || 0));
export const pctL = (v: number) => nf1.format(v) + " %";
export const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-10-26 -> 26-10-2026 */
export const fd = (s?: string | null) => (s ? s.split("-").reverse().join("-") : "—");
export const fdw = (s?: string | null) =>
  s ? `${DOW[new Date(s + "T00:00:00Z").getUTCDay()]} ${s.slice(8, 10)}-${s.slice(5, 7)}` : "";

export const short = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return "$" + nf1.format(v / 1e6) + "M";
  if (a >= 1e3) return "$" + Math.round(v / 1e3) + "K";
  return "$" + Math.round(v);
};

/** Nombre corto: quita sufijo societario. */
export const sn = (n: string | null | undefined) => (n || "").replace(/ (S\.A\.|Ltda\.|SpA)$/, "");

export const condL = (c: number) =>
  +c === 0 ? "Contado" : +c === 30 ? "Crédito 30 días" : +c === 60 ? "Crédito 60 días" : `Otro (${c} días)`;
export const condS = (c: number) => (+c === 0 ? "Contado" : `Créd. ${c} d`);
export const condKey = (c: number) => ([0, 30, 60].includes(+c) ? String(+c) : "otro");

export const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
export const mStart = (i: number, y = 2026) => new Date(Date.UTC(y, i, 1)).toISOString().slice(0, 10);
export const mEnd = (i: number, y = 2026) => new Date(Date.UTC(y, i + 1, 0)).toISOString().slice(0, 10);

/** Reemplaza TODAS las apariciones de cada variable {x}. */
export function fillTemplate(tpl: string, vars: Record<string, string | number>) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/**
 * Neutraliza inyección de fórmulas en CSV/Excel: una celda de texto que empiece con
 * = + - @ (o tab/CR) se prefija con apóstrofe. Los números pasan tal cual.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "number" ? String(v) : String(v);
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(cols: string[], rows: unknown[][]): string {
  return "﻿" + [cols, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

/** Nombre de archivo seguro (sin rutas ni caracteres peligrosos). */
export function safeFileName(name: string, max = 120) {
  const base = name.split(/[\\/]/).pop() || "archivo";
  return base.replace(/[^\p{L}\p{N}._\- ()]/gu, "_").slice(0, max);
}
