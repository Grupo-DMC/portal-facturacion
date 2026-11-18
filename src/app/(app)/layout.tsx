import { AppProvider } from "@/components/app-context";
import { Overlays } from "@/components/overlays";
import { Shell } from "@/components/shell";
import { requireUser } from "@/server/auth";
import { snapshot } from "@/server/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppProvider snapshot={snapshot()} user={user}>
      <Shell>{children}</Shell>
      <Overlays />
    </AppProvider>
  );
}
