"use client";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { demoLogin, login, type LoginState } from "@/server/auth-actions";

export function LoginForm({ demo }: { demo: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-4">
      <div>
        <h1 className="text-[32px]">Ingresar</h1>
        <p className="mt-1.5 text-sm text-neutral-700">Usa el mismo usuario y contraseña de los demás sistemas DMC.</p>
      </div>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <div className="field">
          <label htmlFor="user">Usuario</label>
          <input id="user" name="user" defaultValue={state.user} key={state.user ?? ""} className="input" placeholder="nombre.apellido" autoComplete="username" autoFocus required maxLength={80} aria-invalid={!!state.error || undefined} />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" className="input" placeholder="••••••••" autoComplete="current-password" required maxLength={200} aria-invalid={!!state.error || undefined} />
        </div>
        {state.error && <p className="field-err !mt-0" role="alert">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn btn-primary w-full !justify-between !px-3.5 !py-3">
          <span>{pending ? "Ingresando…" : "Ingresar"}</span><ArrowRight size={16} aria-hidden />
        </button>
      </form>
      {demo && (
        <>
          <div className="mt-2 h-0.5 bg-divider" />
          <div>
            <p className="text-xs text-neutral-700">Acceso de demostración (datos ficticios)</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([["fact", "Facturación"], ["ger", "Gerencia"], ["admin", "Admin"]] as const).map(([role, label]) => (
                <form key={role} action={demoLogin.bind(null, role)}>
                  <button type="submit" className="btn btn-secondary w-full !justify-start">{label}</button>
                </form>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-700">Clave demo: <code>Dmc2026!</code> · usuarios <code>mjgonzalez</code>, <code>gherrera</code>, <code>amunoz</code></p>
          </div>
        </>
      )}
    </div>
  );
}
