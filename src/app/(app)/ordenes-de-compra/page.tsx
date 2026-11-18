import type { Metadata } from "next";
import { OcView } from "@/components/views/lists";

export const metadata: Metadata = { title: "Órdenes de compra" };
export default function Page() {
  return <OcView />;
}
