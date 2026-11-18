import "server-only";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const INK = rgb(0.125, 0.118, 0.114), MUTED = rgb(0.376, 0.365, 0.365), ACCENT = rgb(0.925, 0.188, 0.075), RULE = rgb(0.84, 0.83, 0.83), SURFACE = rgb(0.918, 0.914, 0.914);

/** pdf-lib con fuentes estándar solo codifica WinAnsi: se sanea todo texto para que nunca lance. */
export const clean = (s: unknown) => String(s ?? "").replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•·€]/g, "?");

export interface PdfCol { l: string; al: "left" | "right" }
export interface PdfTable { title: string; subtitle: string; meta?: string[]; cols: PdfCol[]; rows: string[][]; foot?: string[]; note?: string }

export async function renderTablePdf(t: PdfTable, opts: { landscape?: boolean } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(t.title).slice(0, 120));
  doc.setAuthor("DMC Facturación");
  doc.setCreator("DMC Facturación");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const landscape = opts.landscape ?? t.cols.length > 6;
  const PW = landscape ? 841.89 : 595.28, PH = landscape ? 595.28 : 841.89, M = 36;
  const fs = t.cols.length > 12 ? 6.5 : t.cols.length > 8 ? 7.5 : 8.5;
  const rowH = fs + 8;
  const usable = PW - 2 * M;

  // anchos proporcionales al contenido (con piso y tope)
  const want = t.cols.map((c, i) => Math.min(150, Math.max(bold.widthOfTextAtSize(clean(c.l), fs) + 10, ...t.rows.slice(0, 80).map((r) => font.widthOfTextAtSize(clean(r[i]), fs) + 10), t.foot ? font.widthOfTextAtSize(clean(t.foot[i]), fs) + 10 : 0)));
  const sum = want.reduce((a, b) => a + b, 0);
  const widths = want.map((w) => (w / sum) * usable);

  const fit = (s: string, w: number, f: PDFFont) => {
    let x = clean(s);
    if (f.widthOfTextAtSize(x, fs) <= w - 8) return x;
    while (x.length > 1 && f.widthOfTextAtSize(x + "...", fs) > w - 8) x = x.slice(0, -1);
    return x + "...";
  };

  let page!: PDFPage, y = 0, pageNo = 0;
  const header = () => {
    page = doc.addPage([PW, PH]);
    pageNo++;
    y = PH - M;
    page.drawText("dMC", { x: M, y: y - 16, size: 20, font: bold, color: INK });
    page.drawText("d", { x: M, y: y - 16, size: 20, font: bold, color: ACCENT });
    page.drawText("Comercializadora DMC SpA", { x: M, y: y - 28, size: 7.5, font, color: MUTED });
    const title = clean(t.title);
    page.drawText(title, { x: PW - M - bold.widthOfTextAtSize(title, 14), y: y - 14, size: 14, font: bold, color: INK });
    const sub = clean(t.subtitle);
    page.drawText(sub, { x: PW - M - font.widthOfTextAtSize(sub, 8.5), y: y - 27, size: 8.5, font, color: MUTED });
    y -= 40;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1.5, color: INK });
    y -= 12;
    if (pageNo === 1) for (const m of t.meta ?? []) { page.drawText(clean(m), { x: M, y: y - 8, size: 8.5, font, color: INK }); y -= 12; }
    y -= 6;
    tableHead();
  };
  const tableHead = () => {
    let x = M;
    page.drawRectangle({ x: M, y: y - rowH, width: usable, height: rowH, color: SURFACE });
    t.cols.forEach((c, i) => {
      const s = fit(c.l.toUpperCase(), widths[i], bold);
      page.drawText(s, { x: c.al === "right" ? x + widths[i] - 4 - bold.widthOfTextAtSize(s, fs) : x + 4, y: y - rowH + 4, size: fs, font: bold, color: MUTED });
      x += widths[i];
    });
    y -= rowH;
  };
  const line = (cells: string[], f: PDFFont, color = INK) => {
    let x = M;
    cells.forEach((v, i) => {
      const s = fit(v, widths[i], f);
      page.drawText(s, { x: t.cols[i].al === "right" ? x + widths[i] - 4 - f.widthOfTextAtSize(s, fs) : x + 4, y: y - rowH + 4, size: fs, font: f, color });
      x += widths[i];
    });
    y -= rowH;
  };

  header();
  for (const r of t.rows) {
    if (y - rowH < M + 24) header();
    line(r, font);
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.4, color: RULE });
  }
  if (t.foot) {
    if (y - rowH * 1.4 < M + 24) header();
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1.5, color: INK });
    y -= 2;
    line(t.foot, bold);
  }
  if (t.note) { y -= 8; page.drawText(clean(t.note), { x: M, y: y - 8, size: 7.5, font, color: MUTED }); }
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(`Página ${i + 1} de ${pages.length}`, { x: PW - M - 60, y: 18, size: 7, font, color: MUTED }));
  return doc.save();
}

export interface PdfKV { k: string; v: string }
/** Documento simple de ficha (factura): bloques clave/valor + tablas pequeñas. */
export async function renderFichaPdf(f: { title: string; subtitle: string; blocks: { heading: string; kv?: PdfKV[]; table?: { cols: PdfCol[]; rows: string[][] } }[] }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(f.title));
  doc.setAuthor("DMC Facturación");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const PW = 595.28, PH = 841.89, M = 44;
  let page = doc.addPage([PW, PH]);
  let y = PH - M;
  const ensure = (h: number) => { if (y - h < M) { page = doc.addPage([PW, PH]); y = PH - M; } };
  page.drawText("d", { x: M, y: y - 20, size: 24, font: bold, color: ACCENT });
  page.drawText("MC", { x: M + 15, y: y - 20, size: 24, font: bold, color: INK });
  page.drawText(clean(f.title), { x: PW - M - bold.widthOfTextAtSize(clean(f.title), 16), y: y - 16, size: 16, font: bold, color: INK });
  page.drawText(clean(f.subtitle), { x: PW - M - font.widthOfTextAtSize(clean(f.subtitle), 9), y: y - 30, size: 9, font, color: MUTED });
  y -= 44;
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 2, color: INK });
  y -= 22;
  for (const b of f.blocks) {
    ensure(40);
    page.drawText(clean(b.heading), { x: M, y, size: 11, font: bold, color: INK });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 1, color: INK });
    y -= 14;
    if (b.kv) {
      for (let i = 0; i < b.kv.length; i += 2) {
        ensure(26);
        [b.kv[i], b.kv[i + 1]].forEach((kv, j) => {
          if (!kv) return;
          const x = M + j * ((PW - 2 * M) / 2);
          page.drawText(clean(kv.k), { x, y, size: 7.5, font, color: MUTED });
          page.drawText(clean(kv.v).slice(0, 60), { x, y: y - 11, size: 9.5, font: bold, color: INK });
        });
        y -= 28;
      }
    }
    if (b.table) {
      const w = (PW - 2 * M) / b.table.cols.length;
      ensure(16);
      b.table.cols.forEach((c, i) => page.drawText(clean(c.l).toUpperCase(), { x: c.al === "right" ? M + w * (i + 1) - 4 - bold.widthOfTextAtSize(clean(c.l).toUpperCase(), 7) : M + w * i + 2, y, size: 7, font: bold, color: MUTED }));
      y -= 12;
      for (const r of b.table.rows) {
        ensure(14);
        r.forEach((v, i) => { let s = clean(v); while (s.length > 1 && font.widthOfTextAtSize(s, 8.5) > w - 6) s = s.slice(0, -1); page.drawText(s, { x: b.table!.cols[i].al === "right" ? M + w * (i + 1) - 4 - font.widthOfTextAtSize(s, 8.5) : M + w * i + 2, y, size: 8.5, font, color: INK }); });
        page.drawLine({ start: { x: M, y: y - 4 }, end: { x: PW - M, y: y - 4 }, thickness: 0.4, color: RULE });
        y -= 14;
      }
    }
    y -= 12;
  }
  return doc.save();
}
