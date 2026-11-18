"use client";
import { Mail, MessageCircle, Phone, Users } from "lucide-react";
import { CANALES } from "@/lib/domain";
import type { Row } from "@/lib/types";
import { cobSteps, stepStyle } from "@/lib/view";
import { useApp } from "./app-context";

const ICONS = { mail: Mail, msg: MessageCircle, users: Users, call: Phone } as const;
export const CanalIcon = ({ name, size = 14 }: { name: keyof typeof ICONS; size?: number }) => {
  const I = ICONS[name];
  return <I size={size} aria-hidden />;
};

/** Cuatro casillas 1-4 del escalamiento. */
export function Steps({ r, size = "md" }: { r: Row; size?: "sm" | "md" }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`Escalamiento: ${r.nivel} de 4 pasos hechos`}>
      {cobSteps(r).map((s) => (
        <span key={s.n} title={s.title} className={`grid place-items-center font-extrabold ${size === "sm" ? "h-4 w-5 text-[9px]" : "h-[18px] w-[22px] text-[10px]"}`} style={stepStyle(s)}>{s.n}</span>
      ))}
    </div>
  );
}

/** Botones por canal: el siguiente paso sugerido va resaltado. */
export function CanalButtons({ r }: { r: Row }) {
  const { openModal, canEdit } = useApp();
  if (!canEdit) return null;
  return (
    <div className="flex justify-end gap-0.5">
      {CANALES.map((c, i) => {
        const next = i === Math.min(3, r.nivel);
        return (
          <button key={c.canal} type="button" title={`Registrar gestión · ${i + 1} ${c.canal}${next ? " (siguiente)" : ""}`} aria-label={`Registrar gestión por ${c.canal} en folio ${r.folio}`}
            onClick={(e) => { e.stopPropagation(); openModal({ type: "gestion", folio: r.folio, canal: c.canal }); }}
            className="grid size-[30px] place-items-center border p-0"
            style={{ borderColor: next ? "var(--color-accent)" : "var(--color-divider)", background: next ? "var(--color-accent)" : "var(--color-bg)", color: next ? "#fff" : "var(--color-ink)" }}>
            <CanalIcon name={c.icon} />
          </button>
        );
      })}
    </div>
  );
}
