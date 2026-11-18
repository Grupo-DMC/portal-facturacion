import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, SESSION_TTL_S, signSession, verifySession } from "@/lib/session-token";
import type { AppUser, Role, SessionUser } from "@/lib/types";
import { data } from "./store";

// ───────────── Contraseñas (scrypt + sal por usuario) ─────────────
interface Cred { salt: string; hash: string }
const g = globalThis as unknown as { __dmcCreds?: Map<string, Cred> };

const hashPw = (pw: string, salt: string) => scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");

/** Usuarios demo: misma clave (DEMO_PASSWORD o por defecto) solo si DEMO_MODE !== "false". */
function creds(): Map<string, Cred> {
  if (g.__dmcCreds) return g.__dmcCreds;
  const m = new Map<string, Cred>();
  if (demoEnabled()) {
    const pw = process.env.DEMO_PASSWORD || "Dmc2026!";
    for (const u of data().users) {
      const salt = randomBytes(16).toString("hex");
      m.set(u.id, { salt, hash: hashPw(pw, salt) });
    }
  }
  return (g.__dmcCreds = m);
}

/** Demo: explícito (DEMO_MODE=true) o, fuera de producción, activo salvo que se desactive. Nunca implícito en producción. */
export const demoEnabled = () =>
  process.env.DEMO_MODE === "true" || (process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false");

const DUMMY = { salt: "0".repeat(32), hash: hashPw("dummy", "0".repeat(32)) };

/** Verifica credenciales en tiempo (casi) constante, exista o no el usuario. */
export function verifyLogin(userInput: string, password: string): AppUser | null {
  const q = userInput.trim().toLowerCase();
  const user = data().users.find((u) => u.active && (u.email.toLowerCase() === q || u.email.split("@")[0].toLowerCase() === q)) ?? null;
  const cred = (user && creds().get(user.id)) || DUMMY;
  const given = Buffer.from(hashPw(password, cred.salt), "hex");
  const ok = timingSafeEqual(given, Buffer.from(cred.hash, "hex")) && !!user && creds().has(user.id);
  return ok ? user : null;
}

export const userByRole = (role: Role) => data().users.find((u) => u.active && u.role === role) ?? null;

// ───────────── Sesión ─────────────
export async function startSession(u: AppUser) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession({ uid: u.id, role: u.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Usuario vigente según la cookie firmada. El rol se lee del store (un cambio de rol aplica al instante). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const p = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!p) return null;
  const u = data().users.find((x) => x.id === p.uid && x.active);
  return u ? { id: u.id, name: u.name, ini: u.ini, email: u.email, role: u.role } : null;
}

/** Para páginas/layouts: redirige a /login si no hay sesión. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

export async function requirePageRole(roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect(u.role === "ger" ? "/semanal" : "/");
  return u;
}

/** Roles que pueden modificar datos (Gerencia es solo lectura). */
export const WRITE_ROLES: Role[] = ["fact", "admin"];
export const canWrite = (r: Role) => WRITE_ROLES.includes(r);
