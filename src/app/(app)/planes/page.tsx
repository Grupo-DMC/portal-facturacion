import type { Metadata } from "next";
import { PlanesView } from "@/components/views/lists";

export const metadata: Metadata = { title: "Planes de cuotas" };
export default function Page() {
  return <PlanesView />;
}
