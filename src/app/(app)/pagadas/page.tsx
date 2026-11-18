import type { Metadata } from "next";
import { PagadasView } from "@/components/views/lists";

export const metadata: Metadata = { title: "Pagadas" };
export default function Page() {
  return <PagadasView />;
}
