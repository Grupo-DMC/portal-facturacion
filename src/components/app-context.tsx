"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { derive, holidaySet, type Derived } from "@/lib/domain";
import type { ActionResult, Client, Role, SessionUser, Snapshot } from "@/lib/types";

export type InvoiceFormInit = { mode: "new"; clientId?: string; cuotas?: boolean; ref?: { tipo: "OC cliente" | "Cotización DMC"; num: string }; sucursal?: string } | { mode: "edit"; folio: number } | { mode: "cuota"; planId: string; n: number };

export type Modal =
  | { type: "factura"; init: InvoiceFormInit }
  | { type: "pago"; folio: number; partial?: boolean }
  | { type: "anular"; folio: number }
  | { type: "gestion"; folio: number; canal?: string }
  | { type: "envio"; folio: number }
  | { type: "plan"; id: string }
  | { type: "correo"; clientId: string }
  | { type: "edo"; clientId: string }
  | { type: "ref"; tipo: string; num: string };

interface Toast { id: number; text: string; kind: "ok" | "err" }

export interface Ctx {
  snap: Snapshot;
  user: SessionUser;
  role: Role;
  canEdit: boolean;
  isAdmin: boolean;
  d: Derived;
  cmap: Record<string, Client>;
  today: string;
  hs: Set<string>;
  month: number;
  setMonth: (m: number) => void;
  drawer: number | null;
  openDrawer: (folio: number | null) => void;
  modal: Modal | null;
  openModal: (m: Modal | null) => void;
  subClient: boolean;
  setSubClient: (v: boolean) => void;
  toast: (text: string, kind?: "ok" | "err") => void;
  toasts: Toast[];
  run: <T>(p: Promise<ActionResult<T>>) => Promise<ActionResult<T>>;
  busy: boolean;
  rowH: number;
  setRowH: (n: number) => void;
}

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(C);
  if (!c) throw new Error("useApp fuera de AppProvider");
  return c;
};

export function AppProvider({ snapshot, user, children }: { snapshot: Snapshot; user: SessionUser; children: ReactNode }) {
  const d = useMemo(() => derive(snapshot), [snapshot]);
  const hs = useMemo(() => holidaySet(snapshot.config), [snapshot.config]);
  const cmap = d.cmap;
  const [month, setMonth] = useState(() => Math.min(11, +snapshot.today.slice(5, 7) - 1));
  const [drawer, setDrawer] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [subClient, setSubClient] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [rowH, setRowHState] = useState(40);
  const seq = useRef(0);

  // preferencia por-usuario (comodidad): altura de fila
  useEffect(() => {
    try { const v = +(localStorage.getItem("dmc.rowH") || 0); if ([32, 40, 48].includes(v)) setRowHState(v); } catch { /* sin storage */ }
  }, []);
  const setRowH = useCallback((n: number) => { setRowHState(n); try { localStorage.setItem("dmc.rowH", String(n)); } catch { /* noop */ } }, []);

  const toast = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = ++seq.current;
    setToasts((s) => [...s, { id, text, kind }]);
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), kind === "err" ? 6000 : 3600);
  }, []);

  const run = useCallback(async <T,>(p: Promise<ActionResult<T>>) => {
    setBusy(true);
    try {
      const r = await p;
      if (r.ok) { if (r.message) toast(r.message); }
      else if (!r.fieldErrors || !Object.keys(r.fieldErrors).length) toast(r.error, "err");
      return r;
    } catch {
      toast("No se pudo conectar con el servidor. Reintenta.", "err");
      return { ok: false, error: "Sin conexión" } as ActionResult<T>;
    } finally { setBusy(false); }
  }, [toast]);

  const value: Ctx = {
    snap: snapshot, user, role: user.role, canEdit: user.role !== "ger", isAdmin: user.role === "admin", d, cmap, today: snapshot.today, hs,
    month, setMonth, drawer, openDrawer: setDrawer, modal, openModal: (m) => { setModal(m); if (!m) setSubClient(false); }, subClient, setSubClient,
    toast, toasts, run, busy, rowH, setRowH,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
