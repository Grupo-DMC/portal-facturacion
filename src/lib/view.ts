import { CANALES, addDays } from "./domain";
import { clp, fd, fdw } from "./format";
import type { Row } from "./types";

export const BAD = "#ae1800";
export const GOOD = "var(--color-good)";
export const AMB = "var(--color-warn)";
export const MUTED = "var(--color-neutral-700)";

/** Texto y color del "vence / días en cobranza" de una factura. */
export function diasInfo(r: Row): { text: string; color: string } {
  if (r.status === "Pagada") return { text: "pagada " + fd(r.lastPay?.fecha).slice(0, 5), color: MUTED };
  if (r.status === "Anulada") return { text: "NC " + (r.nc?.num ?? ""), color: MUTED };
  if (r.status === "En cobranza") return { text: `+${r.diasCob} días en cobranza`, color: BAD };
  return { text: r.dias === 0 ? "vence hoy" : `vence en ${r.dias} día${r.dias === 1 ? "" : "s"}`, color: r.dias <= 5 ? AMB : MUTED };
}

export function compLabel(r: Row, today: string) {
  if (!r.comp?.compromiso) return "";
  const c = r.comp.compromiso;
  const tag = r.compEstado === "incumplido" ? "Incumplido" : r.compEstado === "hoy" ? "Hoy" : r.compEstado === "cumplido" ? "Cumplido" : c.fecha === addDays(today, 1) ? "Mañana" : fdw(c.fecha);
  return `${tag} ${c.hora || ""} · ${clp(c.monto)}`;
}

export interface Step { n: number; l: string; done: boolean; next: boolean; title: string; when: string }
/** Los 4 pasos del escalamiento de cobranza: 1 Correo → 2 WhatsApp → 3 Otros contactos → 4 Llamada. */
export function cobSteps(r: Row): Step[] {
  return CANALES.map((c, i) => {
    const g = (r.gestiones || []).filter((x) => x.canal === c.canal).slice(-1)[0];
    const done = i < r.nivel;
    const next = i === Math.min(3, r.nivel) && r.status === "En cobranza";
    return { n: i + 1, l: c.canal, done, next, title: `${i + 1} · ${c.canal}${g ? " · " + fd(g.fecha) : next ? " · siguiente" : ""}`, when: g ? `${fd(g.fecha)} ${g.hora || ""}` : next ? "siguiente" : "—" };
  });
}

export const stepStyle = (s: Step) => ({
  background: s.done ? "var(--color-ink)" : s.next ? "var(--color-accent-100)" : "var(--color-neutral-200)",
  color: s.done ? "var(--color-bg)" : s.next ? "var(--color-accent-700)" : "var(--color-neutral-700)",
  boxShadow: s.next ? "inset 0 0 0 1px var(--color-accent)" : undefined,
});
