import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { flatErrors } from "@/lib/schemas";
import type { ActionResult, Role, SessionUser } from "@/lib/types";
import { getSessionUser, WRITE_ROLES } from "./auth";

export const err = (error: string, fieldErrors?: Record<string, string>): ActionResult => ({ ok: false, error, fieldErrors });
export const ok = <T = undefined>(message?: string, data?: T): ActionResult<T> => ({ ok: true, message, data });

/**
 * Envoltorio de TODA mutación: 1) sesión vigente, 2) rol autorizado en el servidor,
 * 3) validación Zod de la entrada, 4) errores controlados (no filtra detalles internos), 5) revalida la UI.
 */
export async function guard<S extends z.ZodType, T = undefined>(
  roles: Role[],
  schema: S,
  input: unknown,
  fn: (d: z.infer<S>, user: SessionUser) => ActionResult<T> | Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };
  if (!roles.includes(user.role)) return { ok: false, error: "No tienes permiso para esta acción." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los campos marcados.", fieldErrors: flatErrors(parsed.error) };
  try {
    const res = await fn(parsed.data, user);
    if (res.ok) revalidatePath("/", "layout");
    return res;
  } catch (e) {
    console.error("[action]", e instanceof Error ? e.message : e);
    return { ok: false, error: "No se pudo completar la acción. Intenta de nuevo." };
  }
}

export { WRITE_ROLES };
export const ADMIN: Role[] = ["admin"];

/** "María José González" -> "M. José González" (formato de auditoría de la maqueta). */
export const userShort = (u: SessionUser) =>
  u.name.split(" ").map((p, i) => (i === 0 ? p[0] + "." : p)).slice(0, 3).join(" ");
