import type { Metadata } from "next";
import { ConfigView } from "@/components/views/config-view";
import { requirePageRole } from "@/server/auth";

export const metadata: Metadata = { title: "Configuración" };
export default async function Page() {
  await requirePageRole(["admin"]);
  return <ConfigView />;
}
