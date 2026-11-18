import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { snapshot } from "@/server/store";
import { derive } from "@/lib/domain";
import { buildReport, REPORTS, type RepKey } from "@/lib/reports";
import { clp, condL, fd, sn } from "@/lib/format";
import { renderFichaPdf, renderTablePdf } from "@/server/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pdf = (bytes: Uint8Array, name: string) =>
  new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // inline para verlo en el navegador; nombre saneado
      "Content-Disposition": `inline; filename="${name.replace(/[^\w.\-]/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  // Defensa en profundidad: el proxy ya exige sesión; aquí se vuelve a verificar contra el usuario vigente.
  const user = await getSessionUser();
  if (!user) return bad("No autenticado", 401);
  const { kind, id } = await ctx.params;
  const snap = snapshot();
  const d = derive(snap);

  if (kind === "estado-cuenta") {
    if (!/^[\w-]{1,40}$/.test(id) || !d.cmap[id]) return bad("Cliente no encontrado", 404);
    const r = buildReport(snap, "estado", "all", id);
    const c = d.cmap[id];
    return pdf(await renderTablePdf({ title: "Estado de cuenta", subtitle: r.period, meta: [`${c.name} · RUT ${c.rut}`, c.address, "Transferir a Comercializadora DMC SpA · enviar comprobante indicando N° de folio."], cols: r.cols, rows: r.rows, foot: r.foot }, { landscape: true }), `estado_cuenta_${id}`);
  }

  if (kind === "reporte") {
    if (!(REPORTS as { key: string }[]).some((x) => x.key === id)) return bad("Reporte no encontrado", 404);
    const q = req.nextUrl.searchParams;
    const month = q.get("month") ?? "all";
    const client = q.get("client") ?? "";
    if (!(month === "all" || /^(?:[0-9]|1[01])$/.test(month))) return bad("Período inválido");
    if (client && !/^[\w-]{1,40}$/.test(client)) return bad("Cliente inválido");
    const r = buildReport(snap, id as RepKey, month, client);
    return pdf(await renderTablePdf({ title: r.title, subtitle: r.period, meta: r.note ? [r.note] : [], cols: r.cols, rows: r.rows, foot: r.foot }), `${id}_${month}`);
  }

  if (kind === "factura") {
    const folio = Number(id);
    const r = Number.isInteger(folio) ? d.byF[folio] : undefined;
    if (!r) return bad("Factura no encontrada", 404);
    const c = d.cmap[r.clientId];
    return pdf(await renderFichaPdf({
      title: `Factura N° ${r.folio}`, subtitle: `${r.status}${r.anulada && r.nc ? ` · NC ${r.nc.num}` : ""} · emitida ${fd(r.emision)}`,
      blocks: [
        { heading: "Receptor", kv: [{ k: "Razón social", v: c?.name ?? "" }, { k: "RUT", v: c?.rut ?? "" }, { k: "Local", v: r.sucursal || "—" }, { k: "Servicio", v: r.servicio }] },
        { heading: "Montos", kv: [{ k: "Neto", v: clp(r.neto) }, { k: "IVA 19 %", v: clp(r.iva) }, { k: "Total", v: clp(r.total) }, { k: "Saldo", v: clp(r.saldo) }, { k: "Condición", v: condL(r.cond) }, { k: "Vencimiento", v: fd(r.venc) }] },
        { heading: "Referencias", table: { cols: [{ l: "Tipo", al: "left" }, { l: "Número", al: "left" }], rows: r.refs.length ? r.refs.map((x) => [x.tipo, x.num]) : [["—", "Sin referencias"]] } },
        { heading: "Pagos", table: { cols: [{ l: "Fecha", al: "left" }, { l: "Medio", al: "left" }, { l: "Comprobante", al: "left" }, { l: "Recibido por", al: "left" }, { l: "Monto", al: "right" }], rows: r.payments.length ? r.payments.map((p) => [fd(p.fecha), p.medio, p.comp || "—", p.recibidoPor, clp(p.monto)]) : [["Sin pagos registrados", "", "", "", ""]] } },
        ...(r.obs ? [{ heading: "Observaciones", kv: [{ k: "Nota", v: r.obs }] }] : []),
        { heading: "Datos del cliente", kv: [{ k: "Contacto de pago", v: sn(c?.contact.name) }, { k: "Correo", v: c?.contact.email ?? "" }] },
      ],
    }), `factura_${r.folio}`);
  }
  return bad("Recurso no encontrado", 404);
}
