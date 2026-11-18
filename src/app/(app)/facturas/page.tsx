import type { Metadata } from "next";
import { FacturasView } from "@/components/views/facturas-view";

export const metadata: Metadata = { title: "Facturas" };
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; venc?: string }> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const venc = typeof sp.venc === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.venc) ? sp.venc : "";
  return <FacturasView key={q + venc} initialQ={q} initialVenc={venc} />;
}
