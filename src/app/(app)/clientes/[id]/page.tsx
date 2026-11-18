import type { Metadata } from "next";
import { FichaView } from "@/components/views/clientes-view";

export const metadata: Metadata = { title: "Ficha de cliente" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FichaView id={decodeURIComponent(id).slice(0, 40)} />;
}
