import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { COMPANY } from "@/lib/company";
import type { QuoteLineItem } from "@/lib/types/quoting";
import { formatQuoteMoney, lineExtended } from "@/lib/types/quoting";

export type ProposalPdfInput = {
  title: string;
  clientName: string;
  eventName: string;
  eventDate: string | null;
  department: string;
  intro: string;
  notes: string;
  lines: Pick<
    QuoteLineItem,
    "label" | "quantity" | "list_unit_price" | "quote_unit_price"
  >[];
  preparedBy?: string;
};

function money(n: number): string {
  return formatQuoteMoney(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const day = iso.includes("T") ? iso.slice(0, 10) : iso;
  try {
    return new Date(`${day}T00:00:00`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return day;
  }
}

/** Build a simple branded multi-page proposal PDF. */
export async function buildProposalPdf(
  input: ProposalPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const brand = rgb(0.12, 0.22, 0.28);
  const muted = rgb(0.4, 0.42, 0.45);
  const lineColor = rgb(0.85, 0.86, 0.88);
  const black = rgb(0.1, 0.1, 0.1);

  function ensureSpace(needed: number) {
    if (y - needed < margin + 40) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawText(
    text: string,
    opts: {
      x?: number;
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
    } = {},
  ) {
    const size = opts.size ?? 11;
    const f = opts.bold ? fontBold : font;
    const color = opts.color ?? black;
    const x = opts.x ?? margin;
    const maxWidth = opts.maxWidth ?? contentWidth;
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length === 0) lines.push("");

    for (const l of lines) {
      ensureSpace(size + 4);
      page.drawText(l, { x, y: y - size, size, font: f, color });
      y -= size + 4;
    }
  }

  // Header band
  page.drawRectangle({
    x: 0,
    y: pageHeight - 72,
    width: pageWidth,
    height: 72,
    color: brand,
  });
  page.drawText(COMPANY.displayName.toUpperCase(), {
    x: margin,
    y: pageHeight - 36,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(COMPANY.tagline, {
    x: margin,
    y: pageHeight - 54,
    size: 9,
    font,
    color: rgb(0.85, 0.9, 0.92),
  });
  y = pageHeight - 96;

  drawText(input.title || "Proposal", {
    size: 20,
    bold: true,
    color: brand,
  });
  y -= 6;

  const metaBits = [
    input.clientName ? `Client: ${input.clientName}` : "",
    input.eventName ? `Event: ${input.eventName}` : "",
    input.eventDate ? `Date: ${fmtDate(input.eventDate)}` : "",
    input.department ? `Department: ${input.department}` : "",
  ].filter(Boolean);
  for (const bit of metaBits) {
    drawText(bit, { size: 11, color: muted });
  }
  if (input.preparedBy) {
    drawText(`Prepared by: ${input.preparedBy}`, { size: 10, color: muted });
  }
  y -= 8;

  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: lineColor,
  });
  y -= 16;

  if (input.intro.trim()) {
    drawText(input.intro.trim(), { size: 11 });
    y -= 10;
  }

  // Table header
  ensureSpace(60);
  const colLabel = margin;
  const colQty = margin + contentWidth * 0.48;
  const colUnit = margin + contentWidth * 0.58;
  const colExt = margin + contentWidth * 0.78;

  page.drawRectangle({
    x: margin,
    y: y - 18,
    width: contentWidth,
    height: 20,
    color: rgb(0.94, 0.95, 0.96),
  });
  page.drawText("Description", {
    x: colLabel + 4,
    y: y - 14,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("Qty", {
    x: colQty,
    y: y - 14,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("Unit", {
    x: colUnit,
    y: y - 14,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("Total", {
    x: colExt,
    y: y - 14,
    size: 9,
    font: fontBold,
    color: muted,
  });
  y -= 28;

  let quoteTotal = 0;
  for (const line of input.lines) {
    const ext = lineExtended(line.quote_unit_price, line.quantity);
    quoteTotal += ext;
    ensureSpace(28);
    const label = line.label.slice(0, 60);
    page.drawText(label, {
      x: colLabel + 4,
      y: y - 11,
      size: 10,
      font,
      color: black,
    });
    page.drawText(String(line.quantity), {
      x: colQty,
      y: y - 11,
      size: 10,
      font,
      color: black,
    });
    page.drawText(money(line.quote_unit_price), {
      x: colUnit,
      y: y - 11,
      size: 10,
      font,
      color: black,
    });
    page.drawText(money(ext), {
      x: colExt,
      y: y - 11,
      size: 10,
      font,
      color: black,
    });
    y -= 20;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: lineColor,
    });
    y -= 6;
  }

  y -= 8;
  ensureSpace(40);
  page.drawText("Total", {
    x: colUnit,
    y: y - 14,
    size: 12,
    font: fontBold,
    color: brand,
  });
  page.drawText(money(Math.round(quoteTotal * 100) / 100), {
    x: colExt,
    y: y - 14,
    size: 12,
    font: fontBold,
    color: brand,
  });
  y -= 28;

  if (input.notes.trim()) {
    drawText("Notes", { size: 12, bold: true, color: brand });
    drawText(input.notes.trim(), { size: 10, color: muted });
    y -= 8;
  }

  ensureSpace(70);
  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: lineColor,
  });
  y -= 16;
  drawText(
    `${COMPANY.displayName} · ${COMPANY.address} · ${COMPANY.phone} · ${COMPANY.email}`,
    { size: 8, color: muted },
  );
  drawText(COMPANY.website, { size: 8, color: muted });

  return doc.save();
}

export function proposalFileName(input: {
  clientName: string;
  eventName: string;
  eventDate: string | null;
}): string {
  const safe = (s: string) =>
    s
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40) || "Proposal";
  const dateBit = input.eventDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  return `LRE-Proposal-${safe(input.clientName)}-${safe(input.eventName || "Event")}-${dateBit}.pdf`;
}
