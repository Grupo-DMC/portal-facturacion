import type { FileMeta } from "./types";
import { safeFileName } from "./format";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const OK_EXT = /\.(pdf|xml|jpe?g|png)$/i;

export type FileResult = { ok: true; meta: FileMeta } | { ok: false; error: string };

/**
 * Valida un archivo elegido por el usuario (tipo, tamaño) y devuelve solo sus metadatos.
 * El binario NO se envía en esta versión: cuando haya almacenamiento (BD/blob) debe subirse
 * con validación de firma (magic bytes) y antivirus del lado del servidor.
 */
export function toMeta(f: File, opts: { only?: "pdf" | "pdf-image" } = {}): FileResult {
  if (!OK_EXT.test(f.name)) return { ok: false, error: "Formato no permitido (PDF, XML, JPG o PNG)." };
  if (opts.only === "pdf" && !/\.pdf$/i.test(f.name)) return { ok: false, error: "Debe ser un PDF." };
  if (opts.only === "pdf-image" && /\.xml$/i.test(f.name)) return { ok: false, error: "Adjunta un PDF o una imagen." };
  if (f.size > MAX_FILE_BYTES) return { ok: false, error: "Supera los 10 MB." };
  if (f.size === 0) return { ok: false, error: "El archivo está vacío." };
  const kind = /\.xml$/i.test(f.name) ? "XML" : /cot/i.test(f.name) ? "Cotización" : /(^|[^a-z])oc/i.test(f.name) ? "OC" : "Factura";
  return { ok: true, meta: { name: safeFileName(f.name), size: Math.max(1, Math.round(f.size / 1024)) + " KB", kind } };
}
