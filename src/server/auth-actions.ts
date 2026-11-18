"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { loginSchema } from "@/lib/schemas";
import type { Role } from "@/lib/types";
import { demoEnabled, endSession, startSession, userByRole, verifyLogin } from "./auth";
import { clear, hit, peek } from "./rate-limit";

export interface LoginState { error?: string; user?: string }

async function clientIp() {
  const h = await headers();
  // Detrás de un proxy confiable, x-forwarded-for lo fija el proxy; solo se usa para limitar intentos.
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ user: form.get("user"), password: form.get("password") });
  if (!parsed.success) return { error: "Ingresa usuario y contraseña." };
  const { user, password } = parsed.data;
  const ip = await clientIp();
  const kUser = `login:u:${user.toLowerCase()}:${ip}`;
  const kIp = `login:ip:${ip}`;
  if (!peek(kUser, 5) || !peek(kIp, 30)) return { error: "Demasiados intentos. Espera unos minutos y vuelve a probar.", user };

  const u = verifyLogin(user, password);
  if (!u) {
    hit(kUser, 5, 15 * 60_000);
    hit(kIp, 30, 15 * 60_000);
    // Mensaje único: no revela si el usuario existe.
    return { error: "Usuario o contraseña incorrectos.", user };
  }
  clear(kUser);
  await startSession(u);
  redirect(u.role === "ger" ? "/semanal" : "/");
}

/** Acceso de demostración (solo con DEMO_MODE activo). */
export async function demoLogin(role: Role) {
  if (!demoEnabled() || !["fact", "ger", "admin"].includes(role)) redirect("/login");
  const ip = await clientIp();
  if (!hit(`demo:${ip}`, 30, 60_000).allowed) redirect("/login");
  const u = userByRole(role);
  if (!u) redirect("/login");
  await startSession(u);
  redirect(role === "ger" ? "/semanal" : "/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
