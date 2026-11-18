import "server-only";
import { buildSeed, type SeedData } from "./seed";
import type { Snapshot } from "@/lib/types";

/**
 * Repositorio en memoria con datos ficticios. Es el ÚNICO punto que toca datos:
 * al conectar SQL Server (ver db/mssql.ts) se reemplaza este módulo manteniendo la misma API.
 */
interface Store { data: SeedData; today: string }
const g = globalThis as unknown as { __dmcStore?: Store };

export function getToday() {
  return process.env.DMC_TODAY && /^\d{4}-\d{2}-\d{2}$/.test(process.env.DMC_TODAY) ? process.env.DMC_TODAY : "2026-10-26";
}

export function store(): Store {
  if ((process.env.DATA_SOURCE ?? "mock") !== "mock") {
    throw new Error("DATA_SOURCE=mssql aún no está implementado: ver src/server/db/mssql.ts");
  }
  if (!g.__dmcStore) {
    const today = getToday();
    g.__dmcStore = { data: buildSeed(today), today };
  }
  return g.__dmcStore;
}

export const data = () => store().data;

/** Instantánea para el cliente: copia profunda para que el cliente nunca comparta referencias con el store. */
export function snapshot(): Snapshot {
  const { data: d, today } = store();
  return structuredClone({
    today,
    invoices: d.invoices,
    clients: d.clients,
    plans: d.plans,
    ocs: d.ocs,
    users: d.users,
    config: d.config,
    ncNext: d.ncNext,
    y2025: d.y2025,
  });
}
