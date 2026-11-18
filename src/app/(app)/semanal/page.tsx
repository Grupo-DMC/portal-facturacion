import type { Metadata } from "next";
import { SemanalView } from "@/components/views/semanal-view";

export const metadata: Metadata = { title: "Resumen semanal" };
export default function Page() {
  return <SemanalView />;
}
