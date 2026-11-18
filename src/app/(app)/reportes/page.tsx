import type { Metadata } from "next";
import { ReportesView } from "@/components/views/reportes-view";

export const metadata: Metadata = { title: "Reportes" };
export default function Page() {
  return <ReportesView />;
}
