import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "./types";

export const SESSION_COOKIE = "dmc_session";
export const SESSION_TTL_S = 60 * 60 * 8; // 8 horas

export interface SessionPayload { uid: string; role: Role; iat: number; exp: number }

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET (>= 32 caracteres) es obligatorio en producción");
  return "dev-only-insecure-secret-do-not-use-in-prod-0123456789";
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest();

export function signSession(p: Omit<SessionPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...p, iat: now, exp: now + SESSION_TTL_S }));
  return `${body}.${b64(sign(body))}`;
}

/** Devuelve el payload si la firma es válida y no expiró; si no, null. Nunca lanza por entrada malformada. */
export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token || token.length > 1024) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const expected = sign(body);
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof p.uid !== "string" || !["fact", "ger", "admin"].includes(p.role)) return null;
    if (typeof p.exp !== "number" || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}
