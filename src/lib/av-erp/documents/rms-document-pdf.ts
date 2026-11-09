import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { VENUE_BILLING_NOTE } from "@/lib/av-erp/billing-type";
import { COMPANY } from "@/lib/company";
import { LOGO_ASPECT, LOGO_PNG_BASE64 } from "@/lib/project-contracts/logo-data";
import { toWinAnsi, wrapText } from "@/lib/project-contracts/text";
import {
  rmsBalanceDue,
  rmsDocTitle,
  type RmsDocLine,
  type RmsDocument,
} from "@/lib/av-erp/documents/types";

/* Same look as the branded contracts: black logo band, bronze accents, shaded label cells. */
const BRONZE = rgb(0.788, 0.627, 0.361);
const BLACK = rgb(0.055, 0.055, 0.055);
const CHARCOAL = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.45);
const RULE = rgb(0.86, 0.84, 0.8);
const PANEL = rgb(0.965, 0.955, 0.94);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.18, 0.5, 0.3);

const W = 612;
const H = 792;
const M = 44;
const CW = W - M * 2;
const BOTTOM = 62;

function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const TZ = "America/New_York";

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  // Plain dates (2026-11-07) must not slide a day when read as UTC.
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (plain) return `${Number(plain[2])}/${Number(plain[3])}/${plain[1]}`;
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isServiceLine(l: RmsDocLine): boolean {
  return /^(service|labor|delivery)/i.test(l.typeLabel);
}

/** Headline shown in the top band, for example "Event Estimate". Never just "AV". */
export function rmsDocHeading(kind: RmsDocument["kind"]): string {
  return kind === "contract" ? "Event Agreement" : `Event ${rmsDocTitle(kind)}`;
}

/**
 * Branded customer PDF for estimates, contracts, invoices and receipts:
 * logo band, client and company blocks, details tables, grouped items with subtotals,
 * totals, and a signature box (estimates and contracts) or payments (receipts).
 */
export async function buildRmsDocumentPdf(doc: RmsDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(LOGO_PNG_BASE64);

  const first = pdf.addPage([W, H]);
  const pages: PDFPage[] = [first];
  let page: PDFPage = first;
  let y = H;

  const t = (s: string) => toWinAnsi(s);
  const width = (s: string, size: number, f: PDFFont = font) => f.widthOfTextAtSize(t(s), size);
  const fit = (s: string, size: number, maxW: number, f: PDFFont = font) => {
    let out = t(s);
    if (f.widthOfTextAtSize(out, size) <= maxW) return out;
    while (out.length > 1 && f.widthOfTextAtSize(`${out}...`, size) > maxW) out = out.slice(0, -1);
    return `${out}...`;
  };
  const draw = (
    s: string,
    x: number,
    yy: number,
    size: number,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb>; right?: boolean } = {},
  ) => {
    const f = opts.bold ? bold : font;
    const str = t(s);
    const px = opts.right ? x - f.widthOfTextAtSize(str, size) : x;
    page.drawText(str, { x: px, y: yy, size, font: f, color: opts.color ?? CHARCOAL });
  };

  const heading = rmsDocHeading(doc.kind);

  function band(tall: boolean) {
    const h = tall ? 78 : 40;
    page.drawRectangle({ x: 0, y: H - h, width: W, height: h, color: BLACK });
    page.drawRectangle({ x: 0, y: H - h - 2.5, width: W, height: 2.5, color: BRONZE });
    const lw = tall ? 150 : 92;
    page.drawImage(logo, { x: M, y: H - h / 2 - lw / LOGO_ASPECT / 2, width: lw, height: lw / LOGO_ASPECT });
    if (tall) {
      draw(heading.toUpperCase(), W - M, H - 34, 17, { bold: true, color: BRONZE, right: true });
      draw(`No. ${doc.reference}`, W - M, H - 52, 10, { bold: true, color: WHITE, right: true });
    } else {
      draw(`${heading}  |  ${doc.reference}`, W - M, H - h / 2 - 3, 8.5, { bold: true, color: BRONZE, right: true });
    }
    return h + 2.5;
  }

  function newPage(tall = false) {
    page = pdf.addPage([W, H]);
    pages.push(page);
    y = H - band(tall) - 20;
  }

  function ensure(needed: number) {
    if (y - needed < BOTTOM) newPage(false);
  }

  /** Shaded-label details table. Returns its height. */
  function detailsTable(rows: [string, string][], x: number, top: number, w: number): number {
    const labelW = 88;
    const lines = rows.map(([, v]) => wrapText(t(v) || "-", w - labelW - 10, (s) => font.widthOfTextAtSize(s, 8)));
    let yy = top;
    rows.forEach(([label], i) => {
      const rowH = Math.max(15, lines[i].length * 10 + 5);
      page.drawRectangle({ x, y: yy - rowH, width: labelW, height: rowH, color: PANEL });
      page.drawRectangle({ x, y: yy - rowH, width: w, height: rowH, borderColor: RULE, borderWidth: 0.5 });
      draw(label, x + labelW - 6, yy - 10.5, 8, { bold: true, color: MUTED, right: true });
      lines[i].forEach((ln, j) => draw(ln, x + labelW + 6, yy - 10.5 - j * 10, 8));
      yy -= rowH;
    });
    return top - yy;
  }

  // ---------- Page 1: header ----------
  y = H - band(true) - 20;

  // Client (left) and company (right)
  const topBlock = y;
  let ly = topBlock;
  const client = doc.client;
  draw("BILLED TO", M, ly - 8, 7, { bold: true, color: BRONZE });
  ly -= 17;
  if (client) {
    draw(fit(client.name, 11, 250, bold), M, ly - 10, 11, { bold: true });
    ly -= 14;
    for (const l of [client.contactName, ...client.lines, client.phone, client.email].filter(Boolean) as string[]) {
      draw(fit(l, 8.5, 250), M, ly - 8, 8.5);
      ly -= 11;
    }
  } else {
    draw("-", M, ly - 9, 9, { color: MUTED });
    ly -= 12;
  }

  let ry = topBlock;
  draw("FROM", W - M - 190, ry - 8, 7, { bold: true, color: BRONZE });
  ry -= 17;
  draw(COMPANY.displayName, W - M - 190, ry - 10, 11, { bold: true });
  ry -= 14;
  const addrParts = COMPANY.address.split(/,\s*(.+)/).filter(Boolean);
  for (const l of [...addrParts, COMPANY.phone, COMPANY.email, "videntproductions.com"]) {
    draw(fit(l, 8, 190), W - M - 190, ry - 8, 8, { color: MUTED });
    ry -= 11;
  }
  y = Math.min(ly, ry) - 12;

  // Details tables
  const venueLines = doc.venue ? [doc.venue.name, ...doc.venue.lines].filter(Boolean).join("\n") : "";
  const left: [string, string][] = [];
  if (doc.kind === "invoice") {
    left.push(["Invoice Number", doc.reference]);
    if (doc.dueAt) left.push(["Due Date", fmtDate(doc.dueAt)]);
    if (doc.issuedAt) left.push(["Invoice Date", fmtDate(doc.issuedAt)]);
  } else if (doc.kind === "receipt") {
    left.push(["Receipt For", doc.reference]);
    if (doc.issuedAt) left.push(["Receipt Date", fmtDate(doc.issuedAt)]);
  } else {
    left.push([doc.kind === "contract" ? "Contract Number" : "Estimate Number", doc.reference]);
    if (doc.validUntil) left.push(["Valid Until", fmtDate(doc.validUntil)]);
    if (doc.statusLabel) left.push(["Status", doc.statusLabel]);
  }
  if (venueLines) left.push(["Event Location", venueLines]);

  const right: [string, string][] = [];
  const rental =
    doc.chargeStartsAt || doc.chargeEndsAt
      ? `${fmtWhen(doc.chargeStartsAt) || "-"} to ${fmtWhen(doc.chargeEndsAt) || "-"}`
      : "";
  if (rental) right.push(["Rental Dates", rental]);
  if (doc.gearStartsAt) right.push(["Gear Out", fmtWhen(doc.gearStartsAt)]);
  if (doc.gearEndsAt) right.push(["Gear Back", fmtWhen(doc.gearEndsAt)]);

  const colGap = 14;
  const colW = (CW - colGap) / 2;
  const lh = detailsTable(left, M, y, right.length ? colW : CW);
  const rh = right.length ? detailsTable(right, M + colW + colGap, y, colW) : 0;
  y -= Math.max(lh, rh) + 16;

  // Subject + notes
  ensure(40);
  page.drawRectangle({ x: M, y: y - 13, width: 3, height: 15, color: BRONZE });
  draw(fit(doc.subject || heading, 13, CW - 12, bold), M + 10, y - 10, 13, { bold: true });
  y -= 20;
  if (doc.notes.trim()) {
    for (const ln of wrapText(t(doc.notes.trim()), CW, (s) => font.widthOfTextAtSize(s, 8.5))) {
      ensure(12);
      draw(ln, M, y - 8, 8.5, { color: MUTED });
      y -= 11;
    }
    y -= 4;
  }
  y -= 4;

  // ---------- Items table ----------
  // Customers see items and quantities only. Prices appear once per section, as the section total.
  const cQty = M + CW * 0.72;
  const cTot = M + CW;

  function tableHeader() {
    ensure(24);
    page.drawRectangle({ x: M, y: y - 17, width: CW, height: 17, color: CHARCOAL });
    draw("ITEM", M + 8, y - 12, 7.5, { bold: true, color: BRONZE });
    draw("QTY", cQty, y - 12, 7.5, { bold: true, color: BRONZE, right: true });
    draw("TOTAL", cTot - 8, y - 12, 7.5, { bold: true, color: BRONZE, right: true });
    y -= 17;
  }

  tableHeader();
  for (const section of doc.sections) {
    const sectionTotal = r2(section.lines.reduce((s, l) => s + l.lineTotal, 0));
    const sectionDiscount = r2(section.lines.reduce((s, l) => s + (l.discountAmount ?? 0), 0));
    ensure(44);
    draw(fit(section.name || "Items", 10.5, CW * 0.7, bold), M + 4, y - 14, 10.5, { bold: true });
    draw(money(sectionTotal), cTot - 8, y - 14, 10.5, { bold: true, right: true });
    y -= 21;
    if (sectionDiscount > 0) {
      draw(`Includes ${money(sectionDiscount)} discount`, M + 16, y - 6, 7.5, { color: MUTED });
      y -= 12;
    }
    for (const line of section.lines) {
      const descW = cQty - M - 60;
      const desc = wrapText(t(line.description), descW, (s) => font.widthOfTextAtSize(s, 8.5));
      const noteLines = line.note ? wrapText(t(line.note), descW, (s) => font.widthOfTextAtSize(s, 7.5)) : [];
      const rowH = desc.length * 11 + noteLines.length * 9.5 + 5;
      ensure(rowH + 2);
      desc.forEach((d, i) => draw(d, M + 16, y - 10 - i * 11, 8.5));
      noteLines.forEach((d, i) => draw(d, M + 16, y - 10 - desc.length * 11 - i * 9.5 + 1, 7.5, { color: MUTED }));
      draw(String(line.qty), cQty, y - 10, 8.5, { right: true });
      y -= rowH;
      page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.4, color: RULE });
      y -= 2;
    }
    ensure(18);
    page.drawRectangle({ x: M, y: y - 15, width: CW, height: 15, color: PANEL });
    draw(`${section.name || "Items"} subtotal`, cQty, y - 10.5, 8, { bold: true, color: MUTED, right: true });
    draw(money(sectionTotal), cTot - 8, y - 10.5, 8, { bold: true, right: true });
    y -= 19;
  }

  // ---------- Totals ----------
  const all = doc.sections.flatMap((s) => s.lines);
  const serviceTotal = all.filter(isServiceLine).reduce((s, l) => s + l.lineTotal, 0);
  const equipTotal = all.filter((l) => !isServiceLine(l)).reduce((s, l) => s + l.lineTotal, 0);
  const split = serviceTotal > 0 && equipTotal > 0;

  type Row = { label: string; value: string; strong?: boolean; accent?: boolean };
  const rows: Row[] = [];
  if (split) {
    rows.push({ label: "Rental and equipment", value: money(equipTotal) });
    rows.push({ label: "Labor, delivery and services", value: money(serviceTotal) });
  } else {
    rows.push({ label: "Subtotal", value: money(doc.linesSubtotal) });
  }
  if (doc.surchargeAmount > 0) rows.push({ label: "Surcharge", value: money(doc.surchargeAmount) });
  if (doc.discountAmount > 0) rows.push({ label: "Discount", value: `-${money(doc.discountAmount)}` });
  if (doc.taxAmount > 0) rows.push({ label: "Sales tax", value: money(doc.taxAmount) });
  rows.push({ label: doc.kind === "invoice" || doc.kind === "receipt" ? "Invoice Total" : "Grand Total", value: money(doc.total), strong: true });
  const applied = doc.amountPaid + doc.amountCredited;
  if (doc.kind === "invoice" || doc.kind === "receipt" || applied > 0) {
    if (doc.amountPaid > 0 || doc.kind === "receipt") rows.push({ label: "Payments received", value: money(doc.amountPaid) });
    if (doc.amountCredited > 0) rows.push({ label: "Credits", value: money(doc.amountCredited) });
    rows.push({ label: "Balance Due", value: money(rmsBalanceDue(doc)), strong: true, accent: true });
  }

  ensure(rows.length * 17 + 14);
  y -= 6;
  const tx = M + CW * 0.46;
  const tw = CW - CW * 0.46;
  for (const r of rows) {
    const h = r.strong ? 21 : 17;
    page.drawRectangle({ x: tx, y: y - h, width: tw, height: h, color: r.accent ? BRONZE : r.strong ? BLACK : CHARCOAL });
    const txtColor = r.accent ? BLACK : WHITE;
    draw(r.label, tx + tw - 110, y - h / 2 - 3, r.strong ? 9.5 : 8.5, { bold: r.strong, color: txtColor, right: true });
    draw(r.value, tx + tw - 8, y - h / 2 - 3, r.strong ? 9.5 : 8.5, { bold: true, color: txtColor, right: true });
    y -= h;
  }
  y -= 16;

  if (doc.billingType === "venue") {
    const noteLines = wrapText(t(VENUE_BILLING_NOTE), CW - 24, (s) => bold.widthOfTextAtSize(s, 8.5));
    const nh = noteLines.length * 11 + 12;
    ensure(nh + 10);
    page.drawRectangle({ x: M, y: y - nh, width: CW, height: nh, color: PANEL });
    page.drawRectangle({ x: M, y: y - nh, width: 3, height: nh, color: BRONZE });
    noteLines.forEach((ln, i) => draw(ln, M + 12, y - 14 - i * 11, 8.5, { bold: true }));
    y -= nh + 14;
  }

  if (doc.transportNotes.trim()) {
    ensure(30);
    draw("DELIVERY AND TRANSPORT", M, y - 8, 7, { bold: true, color: BRONZE });
    y -= 14;
    for (const ln of wrapText(t(doc.transportNotes.trim()), CW, (s) => font.widthOfTextAtSize(s, 8.5))) {
      ensure(12);
      draw(ln, M, y - 8, 8.5, { color: MUTED });
      y -= 11;
    }
    y -= 8;
  }

  // ---------- Receipt: payments ----------
  if (doc.kind === "receipt") {
    const pays = doc.payments ?? [];
    ensure(60 + pays.length * 16);
    draw("PAYMENTS RECEIVED", M, y - 8, 7, { bold: true, color: BRONZE });
    y -= 16;
    page.drawRectangle({ x: M, y: y - 16, width: CW, height: 16, color: CHARCOAL });
    draw("DATE", M + 8, y - 11, 7.5, { bold: true, color: BRONZE });
    draw("METHOD", M + 110, y - 11, 7.5, { bold: true, color: BRONZE });
    draw("REFERENCE", M + 220, y - 11, 7.5, { bold: true, color: BRONZE });
    draw("AMOUNT", M + CW - 8, y - 11, 7.5, { bold: true, color: BRONZE, right: true });
    y -= 16;
    if (!pays.length) {
      draw("No payments recorded yet.", M + 8, y - 12, 8.5, { color: MUTED });
      y -= 20;
    }
    for (const p of pays) {
      ensure(18);
      draw(fmtDate(p.receivedAt), M + 8, y - 11, 8.5);
      draw(fit(p.method || "-", 8.5, 100), M + 110, y - 11, 8.5);
      draw(fit(p.reference || "-", 8.5, 170), M + 220, y - 11, 8.5);
      draw(money(p.amount), M + CW - 8, y - 11, 8.5, { bold: true, right: true });
      y -= 16;
      page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.4, color: RULE });
    }
    y -= 14;
    ensure(34);
    const paid = rmsBalanceDue(doc) === 0;
    const label = paid ? "PAID IN FULL" : `BALANCE REMAINING ${money(rmsBalanceDue(doc))}`;
    const lw = width(label, 11, bold) + 28;
    page.drawRectangle({ x: M, y: y - 24, width: lw, height: 24, borderColor: paid ? GREEN : BRONZE, borderWidth: 1.6 });
    draw(label, M + 14, y - 16, 11, { bold: true, color: paid ? GREEN : BRONZE });
    y -= 40;
    ensure(24);
    draw("Thank you. We appreciate your business and look forward to making your event unforgettable.", M, y - 8, 8.5, { color: MUTED });
    y -= 18;
  }

  // ---------- Invoice: payment details ----------
  if (doc.kind === "invoice") {
    ensure(56);
    page.drawRectangle({ x: M, y: y - 13, width: 3, height: 15, color: BRONZE });
    draw("Payment Details", M + 10, y - 10, 12, { bold: true });
    y -= 22;
    const details =
      doc.paymentDetails?.trim() ||
      `Please include invoice ${doc.reference} with your payment. Questions? Call ${COMPANY.phone} or email ${COMPANY.email}.`;
    for (const ln of wrapText(t(details), CW, (s) => font.widthOfTextAtSize(s, 8.5))) {
      ensure(12);
      draw(ln, M, y - 8, 8.5);
      y -= 11;
    }
    y -= 10;
  }

  // ---------- Signature ----------
  if (doc.showSignature) {
    const stamp = doc.signatureStamp;
    const intro =
      doc.kind === "contract"
        ? "I, the undersigned, accept the terms and conditions of rental and agree to this contract."
        : "I agree to the terms of this estimate and understand that Vident Productions will provide me with a contract to secure the rental items and services included in it. Any additions will be reflected in my final invoice.";
    const introLines = wrapText(t(intro), CW - 20, (s) => font.widthOfTextAtSize(s, 8));
    const boxH = 30 + introLines.length * 10.5 + (stamp ? 62 : 46);
    ensure(boxH + 10);
    page.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, borderColor: RULE, borderWidth: 0.8 });
    page.drawRectangle({ x: M, y: y - 18, width: CW, height: 18, color: BLACK });
    draw(stamp ? "ELECTRONICALLY SIGNED" : "ACCEPTED AND AGREED", M + 10, y - 12.5, 8, { bold: true, color: BRONZE });
    let sy = y - 30;
    introLines.forEach((ln) => {
      draw(ln, M + 10, sy, 8);
      sy -= 10.5;
    });
    sy -= 8;
    if (stamp?.imageDataUrl?.startsWith("data:image/")) {
      try {
        const b64 = stamp.imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
        const img = await pdf.embedPng(b64);
        const sc = Math.min((CW * 0.4) / img.width, 40 / img.height, 1);
        page.drawImage(img, { x: M + 10, y: sy - img.height * sc + 6, width: img.width * sc, height: img.height * sc });
      } catch {
        /* blank line below still works */
      }
    }
    const lineY = y - boxH + 22;
    page.drawLine({ start: { x: M + 10, y: lineY }, end: { x: M + CW * 0.46, y: lineY }, thickness: 0.7, color: MUTED });
    page.drawLine({ start: { x: M + CW * 0.52, y: lineY }, end: { x: M + CW * 0.75, y: lineY }, thickness: 0.7, color: MUTED });
    page.drawLine({ start: { x: M + CW * 0.81, y: lineY }, end: { x: M + CW - 10, y: lineY }, thickness: 0.7, color: MUTED });
    draw(stamp?.signerName?.trim() ? `Signed: ${stamp.signerName.trim()}` : "Signed", M + 10, lineY - 10, 7.5, { color: MUTED });
    draw("Printed", M + CW * 0.52, lineY - 10, 7.5, { color: MUTED });
    draw(stamp?.signedAt ? fmtDate(stamp.signedAt) : "Date", M + CW * 0.81, lineY - 10, 7.5, { color: MUTED });
    y -= boxH + 16;
  }

  // ---------- Terms ----------
  if (doc.terms.trim()) {
    ensure(40);
    page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.5, color: RULE });
    y -= 14;
    draw("TERMS AND CONDITIONS", M, y - 8, 7, { bold: true, color: BRONZE });
    y -= 14;
    for (const ln of wrapText(t(doc.terms.trim()), CW, (s) => font.widthOfTextAtSize(s, 7))) {
      ensure(10);
      draw(ln, M, y - 7, 7, { color: MUTED });
      y -= 9.5;
    }
  }

  // ---------- Footers (need the page count) ----------
  const total = pages.length;
  pages.forEach((p, i) => {
    page = p;
    p.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.6, color: BRONZE });
    draw(`${COMPANY.displayName}  |  ${COMPANY.address}`, M, 33, 7, { color: MUTED });
    draw(`${COMPANY.phone}  |  ${COMPANY.email}`, M, 23, 7, { color: MUTED });
    draw(`Page ${i + 1} of ${total}`, W - M, 33, 7, { color: MUTED, right: true });
  });

  return pdf.save();
}

export function rmsDocumentFileName(doc: RmsDocument): string {
  const safe = (s: string) =>
    s
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40) || rmsDocTitle(doc.kind);
  return `Vident-${rmsDocTitle(doc.kind)}-${doc.reference}-${safe(doc.subject)}.pdf`;
}
