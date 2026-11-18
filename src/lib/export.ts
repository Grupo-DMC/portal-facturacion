import { buildCsv, clp, condL, fd } from "./format";
import type { Client, Row } from "./types";

export const INV_COLS = ["Folio", "Emisión", "Receptor", "RUT receptor", "Local", "Servicio", "Condición", "Neto", "IVA", "Total", "Vencimiento", "Cotización", "OC", "HEP", "Estado", "Saldo", "Envío", "NC"];

export function invRow(r: Row, c: Client | undefined): (string | number)[] {
  const rf = (t: string) => r.refs.filter((x) => x.tipo === t).map((x) => x.num).join(" / ");
  return [r.folio, fd(r.emision), c?.name ?? "", c?.rut ?? "", r.sucursal, r.servicio, condL(r.cond), r.anulada ? 0 : r.neto, r.anulada ? 0 : r.iva, r.anulada ? 0 : r.total, fd(r.venc), rf("Cotización DMC"), rf("OC cliente"), rf("HEP"), r.status, r.saldo,
    r.envio?.estado === "Enviada" ? `Enviada ${fd(r.envio.fecha)} · ${r.envio.canal}` : "No enviada", r.nc?.num ?? ""];
}

/** Descarga un CSV (UTF-8 con BOM, separador ;) que abre bien en Excel. Neutraliza fórmulas. */
export function downloadCsv(name: string, cols: string[], rows: unknown[][]) {
  const blob = new Blob([buildCsv(cols, rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[^\w\-.]+/g, "_") + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const clpS = clp;
