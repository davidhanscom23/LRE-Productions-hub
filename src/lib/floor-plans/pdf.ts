import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  CATALOG_BY_KIND,
  elementBounds,
  planInventory,
  shapesFor,
  type FloorPlanData,
} from "./types";

function hexToRgb(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}

/**
 * Landscape letter PDF: title block, plan scaled to fit, inventory list.
 * `blueprint` is optional image bytes drawn faintly under the plan.
 */
export async function buildFloorPlanPdf(opts: {
  title: string;
  subtitle: string;
  data: FloorPlanData;
  blueprint?: { bytes: Uint8Array; type: "png" | "jpg" } | null;
}): Promise<Uint8Array> {
  const { data } = opts;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([792, 612]);
  const M = 36;
  const headerH = 44;
  const sideW = 150;
  const areaX = M;
  const areaY = M;
  const areaW = 792 - M * 2 - sideW - 12;
  const areaH = 612 - M * 2 - headerH;

  page.drawText(opts.title.slice(0, 80), { x: M, y: 612 - M - 16, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) });
  if (opts.subtitle) {
    page.drawText(opts.subtitle.slice(0, 100), { x: M, y: 612 - M - 32, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
  }

  // Fit the content bounds (elements, or the whole canvas when empty).
  let minX = 0, minY = 0, maxX = data.widthFt, maxY = data.heightFt;
  if (data.elements.length) {
    const b = data.elements.map(elementBounds);
    minX = Math.max(0, Math.min(...b.map((v) => v.minX)) - 2);
    minY = Math.max(0, Math.min(...b.map((v) => v.minY)) - 2);
    maxX = Math.min(data.widthFt, Math.max(...b.map((v) => v.maxX)) + 2);
    maxY = Math.min(data.heightFt, Math.max(...b.map((v) => v.maxY)) + 2);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min(areaW / spanX, areaH / spanY);
  const ox = areaX + (areaW - spanX * scale) / 2;
  const oy = areaY + (areaH - spanY * scale) / 2;
  // feet -> pdf points (y flipped; drawSvgPath already flips y itself so we use raw page coords).
  const X = (x: number) => ox + (x - minX) * scale;
  const Y = (y: number) => oy + (maxY - y) * scale;

  page.drawRectangle({ x: ox, y: oy, width: spanX * scale, height: spanY * scale, borderColor: rgb(0.6, 0.64, 0.7), borderWidth: 0.8, color: rgb(1, 1, 1) });

  if (opts.blueprint && data.blueprint) {
    const img = opts.blueprint.type === "png" ? await pdf.embedPng(opts.blueprint.bytes) : await pdf.embedJpg(opts.blueprint.bytes);
    const wFt = data.blueprint.naturalW * data.blueprint.ftPerPx;
    const hFt = data.blueprint.naturalH * data.blueprint.ftPerPx;
    page.drawImage(img, { x: X(0), y: Y(hFt), width: wFt * scale, height: hFt * scale, opacity: data.blueprint.opacity });
  }

  const arcCircle = (cx: number, cy: number, r: number) =>
    `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

  for (const el of data.elements) {
    const spec = CATALOG_BY_KIND[el.kind];
    if (!spec) continue;
    if (spec.shape === "text") {
      const size = Math.max(6, el.fontFt * scale);
      const w = font.widthOfTextAtSize(el.label, size);
      page.drawText(el.label, { x: X(el.x) - w / 2, y: Y(el.y) - size / 3, size, font, color: rgb(0.07, 0.07, 0.07) });
      continue;
    }
    for (const s of shapesFor(el)) {
      const fill = s.fill === "none" ? undefined : hexToRgb(s.fill) ?? undefined;
      const common = { borderColor: rgb(0.17, 0.17, 0.17), borderWidth: Math.max(0.3, s.strokeFt * scale), color: fill, borderOpacity: 1 } as const;
      if (s.type === "circle") {
        // drawSvgPath origin is the top-left in page coords with y pointing down.
        page.drawSvgPath(arcCircle(0, 0, s.r * scale), { ...common, x: X(s.cx), y: Y(s.cy) });
      } else {
        const d = s.points.map((p, i) => `${i ? "L" : "M"} ${(p.x - s.points[0].x) * scale} ${(p.y - s.points[0].y) * scale}`).join(" ") + " Z";
        page.drawSvgPath(d, { ...common, x: X(s.points[0].x), y: Y(s.points[0].y) });
      }
    }
    if (el.label && el.kind !== "wall" && el.kind !== "door") {
      const size = Math.max(5, Math.min(9, Math.min(el.w, el.h) * scale * 0.25));
      const w = font.widthOfTextAtSize(el.label, size);
      page.drawText(el.label, { x: X(el.x) - w / 2, y: Y(el.y) - size / 3, size, font, color: rgb(0.07, 0.07, 0.07) });
    }
  }

  // Inventory
  const sx = 792 - M - sideW;
  let sy = 612 - M - headerH + 4;
  page.drawText("Plan contents", { x: sx, y: sy, size: 10, font: bold });
  sy -= 14;
  for (const row of planInventory(data)) {
    if (sy < M + 10) break;
    page.drawText(`${row.count} x ${row.label}`.slice(0, 32), { x: sx, y: sy, size: 8.5, font });
    sy -= 11;
  }
  const feet = `Canvas ${data.widthFt} x ${data.heightFt} ft`;
  page.drawText(feet, { x: sx, y: M, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

  return pdf.save();
}
