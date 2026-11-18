import type { Metadata } from "next";
import { HistoricoView } from "@/components/views/historico-view";

export const metadata: Metadata = { title: "Histórico y estadísticas" };
export default function Page() {
  return <HistoricoView />;
}
