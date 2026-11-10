import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { parseContractBlocks } from "./blocks";
import { LOGO_ASPECT, LOGO_PNG_BASE64 } from "./logo-data";
import { toWinAnsi, wrapText } from "./text";

export type SignatureBlock = {
  signerName: string;
  signerEmail: string;
  signedAtLabel: string;
  ip: string | null;
  documentHash: string | null;
  /** PNG bytes of the drawn signature. */
  png: Uint8Array | null;
};

const BRONZE = rgb(0.788, 0.627, 0.361);
const CHARCOAL = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.45);
const RULE = rgb(0.86, 0.84, 0.8);
const PANEL = rgb(0.965, 0.955, 0.94);

const FOOTER = "LRE Productions  |  101 Marketside Avenue #404-123, Ponte Vedra, FL 32081  |  904-834-1216  |  hello@lreproductions.com";

/** Letter-size branded contract PDF. With `signature`, adds the signed block; without, a blank signature line. */
export async function buildContractPdf(opts: {
  companyName: string;
  title: string;
  body: string;
  projectName: string;
  signature?: SignatureBlock | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(LOGO_PNG_BASE64);
  const W = 612;
  const H = 792;
  const M = 58;
  const BOTTOM = 62;
  const maxW = W - M * 2;
  const size = 9.6;
  const lead = 13.2;

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H;

  const band = (p: PDFPage, tall: boolean) => {
    const h = tall ? 86 : 44;
    p.drawRectangle({ x: 0, y: H - h, width: W, height: h, color: rgb(0.055, 0.055, 0.055) });
    p.drawRectangle({ x: 0, y: H - h - 2.5, width: W, height: 2.5, color: BRONZE });
    const lw = tall ? 168 : 100;
    p.drawImage(logo, { x: M, y: H - h / 2 - lw / LOGO_ASPECT / 2, width: lw, height: lw / LOGO_ASPECT });
    const tag = "PREMIER EVENT PRODUCTION";
    const ts = tall ? 8 : 6.5;
    p.drawText(tag, { x: W - M - bold.widthOfTextAtSize(tag, ts), y: H - h / 2 - 3, size: ts, font: bold, color: BRONZE });
    return h + 2.5;
  };

  y = H - band(page, true) - 34;

  const text = (s: string, x: number, yy: number, sz: number, f: PDFFont, color = CHARCOAL) =>
    page.drawText(s, { x, y: yy, size: sz, font: f, color });
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - band(page, false) - 30;
  };
  const need = (h: number) => {
    if (y - h < BOTTOM) newPage();
  };

  for (const l of wrapText(toWinAnsi(opts.title), maxW, (s) => bold.widthOfTextAtSize(s, 21))) {
    text(l, M, y, 21, bold);
    y -= 27;
  }
  if (opts.projectName) {
    text(toWinAnsi(opts.projectName), M, y, 10.5, font, MUTED);
    y -= 16;
  }
  page.drawRectangle({ x: M, y: y - 3, width: 46, height: 2.5, color: BRONZE });
  y -= 26;

  for (const b of parseContractBlocks(opts.body)) {
    if (b.kind === "heading") {
      const lines = wrapText(toWinAnsi(b.text), maxW - 12, (s) => bold.widthOfTextAtSize(s, 11));
      need(lines.length * 15 + 34);
      y -= 14;
      page.drawRectangle({ x: M, y: y - 3 - (lines.length - 1) * 15, width: 3, height: 13 + (lines.length - 1) * 15, color: BRONZE });
      for (const l of lines) {
        text(l, M + 11, y, 11, bold);
        y -= 15;
      }
      y -= 3;
    } else if (b.kind === "details") {
      const labelW = 112;
      y -= 4;
      for (const r of b.rows) {
        const vlines = wrapText(toWinAnsi(r.value), maxW - labelW - 16, (s) => font.widthOfTextAtSize(s, size));
        const h = Math.max(1, vlines.length) * lead + 9;
        need(h);
        page.drawRectangle({ x: M, y: y - h + 3, width: labelW, height: h, color: PANEL });
        page.drawLine({ start: { x: M, y: y - h + 3 }, end: { x: M + maxW, y: y - h + 3 }, thickness: 0.5, color: RULE });
        text(toWinAnsi(r.label), M + 8, y - 8, 8.6, bold, MUTED);
        vlines.forEach((l, i) => text(l, M + labelW + 10, y - 8 - i * lead, size, font));
        y -= h;
      }
      y -= 8;
    } else if (b.kind === "bullets") {
      for (const it of b.items) {
        const lines = wrapText(toWinAnsi(it), maxW - 18, (s) => font.widthOfTextAtSize(s, size));
        need(lines.length * lead + 3);
        page.drawCircle({ x: M + 6, y: y + 3, size: 1.9, color: BRONZE });
        for (const l of lines) {
          text(l, M + 16, y, size, font);
          y -= lead;
        }
        y -= 2;
      }
      y -= 4;
    } else {
      const indent = b.kind === "clause" ? 14 : 0;
      const raw = b.text;
      const caps = raw.length > 120 && raw === raw.toUpperCase();
      const sz = caps ? 8.6 : size;
      const ld = caps ? 11.6 : lead;
      const lines = wrapText(toWinAnsi(raw), maxW - indent, (s) => font.widthOfTextAtSize(s, sz));
      for (const l of lines) {
        need(ld);
        if (l) text(l, M + indent, y, sz, font);
        y -= ld;
      }
      y -= b.kind === "clause" ? 3 : 6;
    }
  }

  // Signature area
  need(opts.signature ? 200 : 110);
  y -= 8;
  const s = opts.signature;
  if (!s) {
    page.drawRectangle({ x: M, y: y - 74, width: maxW, height: 80, borderColor: RULE, borderWidth: 0.8, color: PANEL });
    text("ACCEPTED AND AGREED", M + 14, y - 12, 8.6, bold, MUTED);
    page.drawLine({ start: { x: M + 14, y: y - 52 }, end: { x: M + 300, y: y - 52 }, thickness: 0.7, color: CHARCOAL });
    page.drawLine({ start: { x: M + 330, y: y - 52 }, end: { x: M + maxW - 14, y: y - 52 }, thickness: 0.7, color: CHARCOAL });
    text("Client signature", M + 14, y - 64, 8, font, MUTED);
    text("Date", M + 330, y - 64, 8, font, MUTED);
    y -= 90;
  } else {
    const top = y;
    page.drawRectangle({ x: M, y: y - 6, width: 3, height: 16, color: BRONZE });
    text("Electronically signed", M + 11, y, 12, bold);
    y -= 14;
    if (s.png) {
      try {
        const img = await pdf.embedPng(s.png);
        const scale = Math.min(200 / img.width, 70 / img.height);
        page.drawImage(img, { x: M + 11, y: y - img.height * scale, width: img.width * scale, height: img.height * scale });
        y -= img.height * scale + 8;
      } catch {
        y -= 6;
      }
    }
    const rows = [
      `Signed by: ${s.signerName}${s.signerEmail ? ` <${s.signerEmail}>` : ""}`,
      `Signed on: ${s.signedAtLabel}`,
      s.ip ? `IP address: ${s.ip}` : "",
      s.documentHash ? `Document fingerprint (SHA-256): ${s.documentHash}` : "",
    ].filter(Boolean);
    for (const r of rows) {
      for (const l of wrapText(toWinAnsi(r), maxW - 11, (t) => font.widthOfTextAtSize(t, 8.5))) {
        need(12);
        text(l, M + 11, y, 8.5, font, MUTED);
        y -= 12;
      }
    }
    void top;
  }

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.5, color: RULE });
    p.drawText(toWinAnsi(FOOTER), { x: M, y: 31, size: 6.8, font, color: MUTED });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: W - M - font.widthOfTextAtSize(label, 7.5), y: 18, size: 7.5, font, color: MUTED });
  });

  return pdf.save();
}
