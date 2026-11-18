"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Bell, CalendarDays, CheckCheck, FileText, Layers, LayoutDashboard, LogOut, Menu, Paperclip, Phone, Search, Settings, FileSpreadsheet, Users, Wallet, X, Lock, ArrowRight } from "lucide-react";
import { useApp } from "./app-context";
import { addDays, draftsDue } from "@/lib/domain";
import { clp, fd, fdw, MESL, mEnd, sn } from "@/lib/format";
import { logout } from "@/server/auth-actions";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/semanal", label: "Resumen semanal", icon: CalendarDays },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/ordenes-de-compra", label: "Órdenes de compra", icon: Paperclip },
  { href: "/pagadas", label: "Pagadas", icon: CheckCheck },
  { href: "/por-cobrar", label: "Por cobrar", icon: Wallet },
  { href: "/cobranza", label: "Cobranza", icon: Phone },
  { href: "/planes", label: "Planes de cuotas", icon: Layers },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/historico", label: "Histórico y estadísticas", icon: BarChart3 },
  { href: "/reportes", label: "Reportes", icon: FileSpreadsheet },
  { href: "/configuracion", label: "Configuración", icon: Settings, admin: true },
] as const;

const ROLE_L = { fact: "Facturación", ger: "Gerencia", admin: "Administrador" } as const;

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const { d, user, today, snap, month, setMonth, openDrawer, openModal, canEdit, isAdmin } = app;
  const path = usePathname();
  const [side, setSide] = useState(false);
  useEffect(() => setSide(false), [path]);

  const counts = useMemo(() => ({
    "/por-cobrar": String(d.rows.filter((r) => r.saldo > 0).length),
    "/cobranza": String(d.rows.filter((r) => r.status === "En cobranza").length),
    "/planes": draftsDue(snap.plans, mEnd(month)).length ? `${draftsDue(snap.plans, mEnd(month)).length} por emitir` : "",
    "/clientes": snap.clients.filter((c) => c.origin === "local").length ? `${snap.clients.filter((c) => c.origin === "local").length} por validar` : "",
  } as Record<string, string>), [d.rows, snap.plans, snap.clients, month]);

  // atajos: N nueva factura, / buscar (no se activan al escribir ni con diálogos abiertos)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("dialog[open]") && e.key !== "p" && e.key !== "P") return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("dmc-gsearch")?.focus(); }
      else if ((e.key === "n" || e.key === "N") && canEdit && !document.querySelector("dialog[open]")) { e.preventDefault(); openModal({ type: "factura", init: { mode: "new" } }); }
      else if ((e.key === "p" || e.key === "P") && canEdit && app.drawer && !app.modal) {
        const r = d.byF[app.drawer];
        if (r && r.saldo > 0) { e.preventDefault(); openModal({ type: "pago", folio: r.folio }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const months = Array.from({ length: Math.min(12, +today.slice(5, 7)) }, (_, i) => i);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:bg-ink focus:p-2 focus:text-bg">Saltar al contenido</a>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col bg-neutral-900 text-neutral-100 transition-transform duration-200 lg:translate-x-0 ${side ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Navegación principal"
      >
        <div className="flex items-end justify-between border-b-2 border-white/15 px-5 pb-[18px] pt-5">
          <div>
            <div className="text-[30px] font-extrabold leading-none tracking-[-0.05em]"><span className="text-accent-400">d</span>MC</div>
            <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-neutral-300">Facturación</div>
          </div>
          <button type="button" className="btn btn-icon text-neutral-100 lg:hidden" onClick={() => setSide(false)} aria-label="Cerrar menú"><X size={16} aria-hidden /></button>
        </div>
        <nav className="flex flex-1 flex-col overflow-auto py-2.5">
          {NAV.filter((n) => !("admin" in n && n.admin) || isAdmin).map((n) => {
            const on = n.href === "/" ? path === "/" : path === n.href || path.startsWith(n.href + "/") || (n.href === "/clientes" && path.startsWith("/clientes"));
            const Ic = n.icon;
            return (
              <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm no-underline ${on ? "bg-accent font-semibold text-white hover:text-white" : "text-neutral-300 hover:bg-white/10 hover:text-white"}`}>
                <Ic size={16} aria-hidden />
                <span className="flex-1">{n.label}</span>
                <span className={`text-[11px] tabular-nums ${on ? "" : "opacity-80"}`}>{counts[n.href]}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5 border-t-2 border-white/15 px-5 py-3.5">
          <div className="grid h-[34px] w-[34px] place-items-center bg-accent text-[13px] font-extrabold text-white" aria-hidden>{user.ini}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">{user.name}</div>
            <div className="text-[11px] text-neutral-300">{ROLE_L[user.role]}</div>
          </div>
          <form action={logout}>
            <button type="submit" className="btn btn-icon !h-[30px] !w-[30px] text-neutral-300 hover:!bg-white/10 hover:!text-white" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} aria-hidden /></button>
          </form>
        </div>
      </aside>
      {side && <div className="fixed inset-0 z-[35] bg-neutral-900/45 lg:hidden" onClick={() => setSide(false)} aria-hidden />}

      <div className="lg:ml-[232px]">
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b-2 border-divider bg-bg px-4 sm:px-6">
          <button type="button" className="btn btn-secondary btn-icon lg:hidden" onClick={() => setSide(true)} aria-label="Abrir menú"><Menu size={16} aria-hidden /></button>
          <GlobalSearch />
          <div className="flex-1" />
          <Bell_ />
          <label className="sr-only" htmlFor="dmc-month">Mes</label>
          <select id="dmc-month" className="input !w-auto min-w-[120px]" value={month} onChange={(e) => setMonth(+e.target.value)}>
            {months.map((i) => <option key={i} value={i}>{MESL[i]} 2026</option>)}
          </select>
          {!canEdit && <span className="tag tag-outline hidden gap-1.5 whitespace-nowrap !px-2.5 !py-1.5 font-semibold sm:inline-flex"><Lock size={14} aria-hidden />Solo lectura</span>}
        </header>
        <main id="main" tabIndex={-1} className="max-w-[1680px] px-4 pb-20 pt-6 sm:px-7">{children}</main>
      </div>
      <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-2" role="status" aria-live="polite">
        {app.toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.kind === "err" ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-accent-400" aria-hidden /> : <CheckCheck size={16} className="mt-0.5 shrink-0 text-accent-400" aria-hidden />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GlobalSearch() {
  const { d, snap, openDrawer, openModal } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 1) return [];
    const digitsQ = s.replace(/[^0-9k]/g, "");
    const out: { kind: string; title: string; sub: string; right: string; go: () => void }[] = [];
    snap.clients.filter((c) => c.name.toLowerCase().includes(s) || (digitsQ.length >= 4 && c.rut.replace(/[.\-]/g, "").toLowerCase().includes(digitsQ))).slice(0, 4)
      .forEach((c) => out.push({ kind: "Cliente", title: c.name, sub: "RUT " + c.rut, right: c.branches.length + " locales", go: () => router.push(`/clientes/${c.id}`) }));
    d.rows.filter((r) => String(r.folio).startsWith(s)).slice(0, 5)
      .forEach((r) => out.push({ kind: "Factura", title: `N° ${r.folio} · ${sn(d.cmap[r.clientId]?.name)}`, sub: `${r.servicio} · ${fd(r.emision)}`, right: clp(r.total), go: () => openDrawer(r.folio) }));
    const seen = new Set<string>();
    d.rows.forEach((r) => r.refs.forEach((x) => {
      const k = x.tipo + x.num;
      if (seen.has(k) || out.length >= 14) return;
      if (x.num.toLowerCase() === s || (s.length >= 4 && x.num.toLowerCase().includes(s))) { seen.add(k); out.push({ kind: x.tipo === "OC cliente" ? "OC" : x.tipo === "HEP" ? "HEP" : "Cotización", title: x.num, sub: sn(d.cmap[r.clientId]?.name), right: "", go: () => openModal({ type: "ref", tipo: x.tipo, num: x.num }) }); }
    }));
    return out.slice(0, 12);
  }, [q, d, snap.clients, router, openDrawer, openModal]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative max-w-[520px] flex-1">
      <Search size={16} className="pointer-events-none absolute left-2.5 top-[10px] text-neutral-700" aria-hidden />
      <input id="dmc-gsearch" role="combobox" aria-expanded={open && q.length > 0} aria-controls="gs-list" aria-label="Buscar folio, OC, cotización, cliente o RUT"
        className="input !pl-[34px] !pr-9" value={q} placeholder="Buscar folio, OC, cotización, cliente o RUT" autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && res[0]) { res[0].go(); setOpen(false); setQ(""); } if (e.key === "Escape") { setOpen(false); (e.target as HTMLElement).blur(); } }} />
      <kbd className="kbd pointer-events-none absolute right-2 top-2 text-neutral-700" aria-hidden>/</kbd>
      {open && q.trim() && (
        <ul id="gs-list" role="listbox" className="absolute inset-x-0 top-[42px] z-50 m-0 max-h-[420px] list-none overflow-auto border border-divider bg-bg p-0 shadow-lg">
          {res.map((g, i) => (
            <li key={i} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { g.go(); setOpen(false); setQ(""); }}
                className="grid w-full grid-cols-[88px_1fr_auto] items-center gap-3 border-0 border-b border-neutral-300 bg-transparent px-3 py-2.5 text-left hover:bg-accent-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-700">{g.kind}</span>
                <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{g.title}</span><span className="block text-xs text-neutral-700">{g.sub}</span></span>
                <span className="text-xs tabular-nums">{g.right}</span>
              </button>
            </li>
          ))}
          {!res.length && <li className="px-3 py-3.5 text-[13px] text-neutral-700">Sin resultados para “{q}”.</li>}
        </ul>
      )}
    </div>
  );
}

function Bell_() {
  const { d, today, openDrawer } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = useMemo(() => d.rows
    .filter((r) => r.compEstado === "hoy" || r.compEstado === "incumplido" || (r.compEstado === "futuro" && r.comp!.compromiso!.fecha <= addDays(today, 1)))
    .sort((a, b) => (a.comp!.compromiso!.fecha < b.comp!.compromiso!.fecha ? -1 : 1)), [d.rows, today]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);
  const tag = (r: (typeof items)[number]) => (r.compEstado === "incumplido" ? "Incumplido" : r.compEstado === "hoy" ? "Hoy" : "Mañana");
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn btn-secondary btn-icon relative" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Compromisos de pago${items.length ? `, ${items.length} pendientes` : ""}`}>
        <Bell size={16} aria-hidden />
        {items.length > 0 && <span className="absolute -right-[7px] -top-[7px] grid h-[18px] min-w-[18px] place-items-center bg-accent px-1 text-[11px] font-extrabold text-white">{items.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-[46px] z-[60] max-h-[480px] w-[min(400px,90vw)] overflow-auto border border-divider border-t-2 border-t-ink bg-bg shadow-lg">
          <div className="flex justify-between border-b border-divider px-3.5 py-3 text-sm font-extrabold"><span>Compromisos de pago</span><span className="text-xs font-semibold text-neutral-700">{items.length ? `${items.length} por atender` : ""}</span></div>
          {items.map((r) => (
            <button key={r.folio} type="button" onClick={() => { setOpen(false); openDrawer(r.folio); }}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-0 border-b border-neutral-300 bg-transparent px-3.5 py-2.5 text-left hover:bg-accent-100">
              <span className="truncate text-[13px] font-bold">{sn(d.cmap[r.clientId]?.name)} · {r.folio}</span>
              <span className={`text-[11px] font-extrabold uppercase tracking-wider ${r.compEstado === "incumplido" ? "text-accent-700" : "text-warn"}`}>{tag(r)}</span>
              <span className="text-xs text-neutral-700">{r.comp!.compromiso!.texto || r.comp!.contacto} · {fdw(r.comp!.compromiso!.fecha)} {r.comp!.compromiso!.hora}</span>
              <span className="text-right text-xs font-bold tabular-nums">{clp(r.comp!.compromiso!.monto)}</span>
            </button>
          ))}
          {!items.length && <div className="p-3.5 text-[13px] text-neutral-700">Sin compromisos pendientes.</div>}
          <Link href="/cobranza" onClick={() => setOpen(false)} className="btn btn-ghost m-1.5 gap-1.5">Mi agenda de cobranza<ArrowRight size={14} aria-hidden /></Link>
        </div>
      )}
    </div>
  );
}

