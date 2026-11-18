import type { Metadata } from "next";
import { PorCobrarView } from "@/components/views/lists";

export const metadata: Metadata = { title: "Por cobrar" };
export default function Page() {
  return <PorCobrarView />;
}
