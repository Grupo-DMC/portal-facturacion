"use client";
import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { X } from "lucide-react";
import { digits, num } from "@/lib/format";
import type { Status } from "@/lib/types";

export const stClass = (s: Status | string) =>
  ({ Pendiente: "st-pendiente", "En cobranza": "st-cobranza", "Pago parcial": "st-parcial", Pagada: "st-pagada", Anulada: "st-anulada", Emitida: "st-emitida", "Por emitir": "st-poremitir" })[s] ?? "st-pendiente";

export const StatusBadge = ({ status, className = "" }: { status: Status | string; className?: string }) => (
  <span className={`badge ${stClass(status)} ${className}`}>{status}</span>
);

/** Encabezado de página: título + línea de apoyo (sin "eyebrow" sobre el título). */
export function PageHead({ title, sub, actions, rule = true }: { title: string; sub?: ReactNode; actions?: ReactNode; rule?: boolean }) {
  return (
    <header className={`flex flex-wrap items-end justify-between gap-4 pb-4 ${rule ? "border-b-2 border-ink" : ""}`}>
      <div>
        <h1>{title}</h1>
        {sub && <p className="mt-1.5 max-w-[70ch] text-sm text-neutral-700">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export interface KpiItem { l: string; v: string; s?: string; c?: string; delta?: string; dc?: string }
export function KpiGrid({ items, min = 200, big }: { items: KpiItem[]; min?: number; big?: boolean }) {
  return (
    <div className="mb-6 grid" style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${min}px,1fr))` }}>
      {items.map((k, i) => (
        <div key={i} className="cell flex flex-col gap-1.5 p-4">
          <div className="kpi-label">{k.l}</div>
          <div className={`whitespace-nowrap ${big ? "text-[23px]" : "text-2xl"} font-extrabold leading-tight tabular-nums`} style={{ color: k.c }}>{k.v}</div>
          {k.s && <div className="text-xs text-neutral-700 tabular-nums">{k.s}</div>}
          {k.delta && <div className="text-xs font-semibold tabular-nums" style={{ color: k.dc }}>{k.delta}</div>}
        </div>
      ))}
    </div>
  );
}

export function Seg<T extends string>({ name, options, value, onChange, label }: { name: string; options: { v: T; l: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.v} className="seg-opt">
          <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} />
          {o.l}
        </label>
      ))}
    </div>
  );
}

/** Pestañas con subrayado grueso (patrón de la maqueta). */
export function Tabs<T extends string | number>({ tabs, value, onChange, label }: { tabs: { v: T; l: ReactNode; n?: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex overflow-x-auto overflow-y-hidden border-b-2 border-ink">
      {tabs.map((t) => {
        const on = t.v === value;
        return (
          <button key={String(t.v)} role="tab" aria-selected={on} type="button" onClick={() => onChange(t.v)}
            className="-mb-0.5 flex flex-none flex-col items-start whitespace-nowrap border-0 border-b-4 bg-transparent px-3.5 pb-2 pt-2.5 text-sm hover:bg-ink/5"
            style={{ borderBottomColor: on ? "var(--color-accent)" : "transparent", fontWeight: on ? 800 : 500 }}>
            <span>{t.l}</span>
            {t.n !== undefined && <span className="text-[11px] font-normal text-neutral-700 tabular-nums">{t.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, error, children, className = "", hint }: { label: ReactNode; error?: string | null; children: ReactNode; className?: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <FieldCtx id={id}>{children}</FieldCtx>
      {hint && <div className="mt-1 text-xs text-neutral-700">{hint}</div>}
      {error && <div className="field-err" role="alert">{error}</div>}
    </div>
  );
}
// Inyecta el id al primer hijo input/select/textarea sin clonar árboles complejos.
function FieldCtx({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector("input,select,textarea");
    if (el && !el.id) el.id = id;
  }, [id]);
  return <div ref={ref} className="contents">{children}</div>;
}

/** Input de montos CLP: muestra miles con punto y entrega un número entero (o null). */
export function MoneyInput({ value, onChange, invalid, className = "", ...rest }: { value: number | null | ""; onChange: (n: number | null) => void; invalid?: boolean } & Omit<ComponentProps<"input">, "value" | "onChange">) {
  return (
    <input
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      aria-invalid={invalid || undefined}
      className={`input text-right tabular-nums ${className}`}
      value={value === null || value === "" ? "" : "$ " + num(value)}
      onChange={(e) => { const d = digits(e.target.value); onChange(d ? Math.min(+d, 2_000_000_000) : null); }}
    />
  );
}

/** Diálogo modal nativo: foco atrapado, Esc, restaura el foco al cerrar. */
export function Dlg({ onClose, title, kicker, children, width = 560, drawer, footer, titleId }: {
  onClose: () => void; title?: ReactNode; kicker?: ReactNode; children: ReactNode; width?: number; drawer?: boolean; footer?: ReactNode; titleId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tid = useId();
  useEffect(() => {
    // Al desmontar, React retira el <dialog> del DOM y con ello de la capa superior: no se llama close().
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId ?? tid}
      className={`dlg ${drawer ? "drawer" : ""}`}
      style={drawer ? undefined : { width: `min(${width}px, calc(100vw - 32px))` }}
      onClose={onClose}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {(title || kicker) && (
        <div className="sticky top-0 z-[2] flex items-start justify-between gap-3 border-b-2 border-ink bg-inherit px-6 pb-3.5 pt-[18px]" style={{ background: drawer ? "var(--color-bg)" : "var(--color-surface)" }}>
          <div className="min-w-0">
            {kicker && <p className="text-xs font-semibold text-neutral-700">{kicker}</p>}
            {title && <h2 id={titleId ?? tid} className="text-[22px]">{title}</h2>}
          </div>
          <button type="button" className="btn btn-secondary btn-icon shrink-0" onClick={onClose} aria-label="Cerrar"><X size={16} aria-hidden /></button>
        </div>
      )}
      <div className={drawer ? "" : "px-6 py-5"}>{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t-2 border-divider px-6 py-4">{footer}</div>}
    </dialog>
  );
}

export function Empty({ icon, title, text, children }: { icon?: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex max-w-[460px] flex-col items-start gap-2.5 px-6 py-14">
      {icon && <span className="text-accent-700">{icon}</span>}
      <div className="text-xl font-extrabold">{title}</div>
      {text && <div className="text-sm text-neutral-700">{text}</div>}
      {children}
    </div>
  );
}

export const Section = ({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) => (
  <section>
    <div className="mb-2 flex items-baseline justify-between gap-3"><h3>{title}</h3>{right && <span className="text-xs text-neutral-700">{right}</span>}</div>
    {children}
  </section>
);

export const Sub = ({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) => (
  <div>
    <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5"><h5>{title}</h5>{right && <span className="text-xs text-neutral-700">{right}</span>}</div>
    {children}
  </div>
);
