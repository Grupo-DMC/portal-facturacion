import type { Metadata } from "next";
import { ClientesView } from "@/components/views/clientes-view";

export const metadata: Metadata = { title: "Clientes" };
export default function Page() {
  return <ClientesView />;
}
