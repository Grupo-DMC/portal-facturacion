import type { Metadata } from "next";
import { demoEnabled } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))" }}>
      <section className="flex min-h-[340px] flex-col justify-between gap-12 bg-accent p-8 text-bg sm:p-12" aria-hidden>
        <div className="text-[34px] font-extrabold leading-none tracking-[-0.05em]"><span className="text-ink">d</span>MC</div>
        <div className="flex flex-col gap-4">
          <div className="text-[clamp(44px,6vw,92px)] font-extrabold leading-[0.92] tracking-[-0.035em]">Facturación,<br />pagos y<br />cobranza.</div>
          <div className="h-0.5 w-full bg-bg" />
          <div className="flex flex-wrap justify-between gap-4 text-[13px]"><span>Comercializadora DMC SpA</span><span>Plataforma unificada Grupo DMC</span></div>
        </div>
      </section>
      <main className="flex items-center p-8 sm:p-12">
        <LoginForm demo={demoEnabled()} />
      </main>
    </div>
  );
}
