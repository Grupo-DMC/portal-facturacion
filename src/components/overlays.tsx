"use client";
import { useApp } from "./app-context";
import { InvoiceDrawer } from "./drawer";
import { InvoiceModal } from "./invoice-modal";
import { AnularModal, CorreoModal, EdoModal, EnvioModal, GestionModal, PagoModal, PlanModal, RefModal } from "./modals";

/** Drawer de factura + modal activo. Se monta una sola vez en el layout. */
export function Overlays() {
  const { drawer, modal, d } = useApp();
  const m = modal;
  const exists = (folio: number) => !!d.byF[folio];
  return (
    <>
      {drawer !== null && exists(drawer) && <InvoiceDrawer key={"drawer-" + drawer} folio={drawer} />}
      {m?.type === "factura" && <InvoiceModal key={"factura-" + JSON.stringify(m.init)} init={m.init} />}
      {m?.type === "pago" && exists(m.folio) && <PagoModal key={"pago-" + m.folio} folio={m.folio} partial={m.partial} />}
      {m?.type === "anular" && exists(m.folio) && <AnularModal key={"anular-" + m.folio} folio={m.folio} />}
      {m?.type === "gestion" && exists(m.folio) && <GestionModal key={"gestion-" + m.folio + (m.canal ?? "")} folio={m.folio} canal={m.canal} />}
      {m?.type === "envio" && exists(m.folio) && <EnvioModal key={"envio-" + m.folio} folio={m.folio} />}
      {m?.type === "plan" && <PlanModal key={"plan-" + m.id} id={m.id} />}
      {m?.type === "correo" && <CorreoModal key={"correo-" + m.clientId} clientId={m.clientId} />}
      {m?.type === "edo" && <EdoModal key={"edo-" + m.clientId} clientId={m.clientId} />}
      {m?.type === "ref" && <RefModal key={"ref-" + m.tipo + m.num} tipo={m.tipo} num={m.num} />}
    </>
  );
}
