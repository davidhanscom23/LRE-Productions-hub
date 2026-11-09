/**
 * Floor plan data model + geometry. Everything is in FEET; element x/y is the
 * element's CENTER. The same shapes feed the editor, the client view and the PDF.
 */

export type ElementKind =
  | "round_table_60"
  | "round_table_48"
  | "rect_table_8"
  | "farm_table"
  | "cocktail_table"
  | "sweetheart_table"
  | "chair"
  | "sofa"
  | "stage"
  | "dance_floor"
  | "bar"
  | "buffet"
  | "podium"
  | "projection_screen"
  | "led_wall"
  | "speaker"
  | "subwoofer"
  | "truss"
  | "foh_console"
  | "camera"
  | "projector"
  | "lighting_stand"
  | "door"
  | "wall"
  | "room"
  | "circle"
  | "rectangle"
  | "text";

export type ElementSpec = {
  kind: ElementKind;
  label: string;
  category: "Tables & seating" | "Stage & AV" | "Room" | "Shapes & text";
  shape: "circle" | "rect" | "text";
  w: number;
  h: number;
  fill: string;
  /** Default seat count (tables only). */
  seats?: number;
  /** Draw as an outline only. */
  outline?: boolean;
};

export const ELEMENT_CATALOG: ElementSpec[] = [
  { kind: "round_table_60", label: 'Round table 60"', category: "Tables & seating", shape: "circle", w: 5, h: 5, fill: "#e8c99b", seats: 8 },
  { kind: "round_table_48", label: 'Round table 48"', category: "Tables & seating", shape: "circle", w: 4, h: 4, fill: "#e8c99b", seats: 6 },
  { kind: "rect_table_8", label: "Rectangular table 8'", category: "Tables & seating", shape: "rect", w: 8, h: 2.5, fill: "#e8c99b", seats: 8 },
  { kind: "farm_table", label: "Farm table", category: "Tables & seating", shape: "rect", w: 8, h: 3, fill: "#d9b48a", seats: 10 },
  { kind: "cocktail_table", label: "Cocktail table", category: "Tables & seating", shape: "circle", w: 2.5, h: 2.5, fill: "#e8c99b" },
  { kind: "sweetheart_table", label: "Sweetheart table", category: "Tables & seating", shape: "rect", w: 5, h: 2.5, fill: "#f2d7e0", seats: 2 },
  { kind: "chair", label: "Chair", category: "Tables & seating", shape: "circle", w: 1.5, h: 1.5, fill: "#4a90d9" },
  { kind: "sofa", label: "Sofa", category: "Tables & seating", shape: "rect", w: 6.5, h: 3, fill: "#9aa5b1" },
  { kind: "stage", label: "Stage / riser", category: "Stage & AV", shape: "rect", w: 16, h: 8, fill: "#c9c9c9" },
  { kind: "dance_floor", label: "Dance floor", category: "Stage & AV", shape: "rect", w: 20, h: 20, fill: "#f3eed8" },
  { kind: "podium", label: "Podium", category: "Stage & AV", shape: "rect", w: 2, h: 2, fill: "#8a6a4a" },
  { kind: "projection_screen", label: "Projection screen", category: "Stage & AV", shape: "rect", w: 10, h: 0.8, fill: "#ffffff" },
  { kind: "led_wall", label: "LED wall", category: "Stage & AV", shape: "rect", w: 12, h: 0.8, fill: "#222222" },
  { kind: "speaker", label: "Speaker", category: "Stage & AV", shape: "rect", w: 1.5, h: 1.5, fill: "#333333" },
  { kind: "subwoofer", label: "Subwoofer", category: "Stage & AV", shape: "rect", w: 2.2, h: 2.2, fill: "#1c1c1c" },
  { kind: "truss", label: "Truss", category: "Stage & AV", shape: "rect", w: 20, h: 1, fill: "#b8b8b8" },
  { kind: "foh_console", label: "FOH / mix position", category: "Stage & AV", shape: "rect", w: 6, h: 3, fill: "#5c6b7a" },
  { kind: "camera", label: "Camera", category: "Stage & AV", shape: "circle", w: 1.6, h: 1.6, fill: "#d94a4a" },
  { kind: "projector", label: "Projector", category: "Stage & AV", shape: "rect", w: 1.6, h: 1.6, fill: "#7a5cc9" },
  { kind: "lighting_stand", label: "Lighting stand", category: "Stage & AV", shape: "circle", w: 1.2, h: 1.2, fill: "#e0a526" },
  { kind: "bar", label: "Bar", category: "Room", shape: "rect", w: 12, h: 2.5, fill: "#8a6a4a" },
  { kind: "buffet", label: "Buffet", category: "Room", shape: "rect", w: 10, h: 2.5, fill: "#b5a58a" },
  { kind: "door", label: "Door", category: "Room", shape: "rect", w: 3, h: 0.6, fill: "#ffffff" },
  { kind: "wall", label: "Wall", category: "Room", shape: "rect", w: 20, h: 0.7, fill: "#111111" },
  { kind: "room", label: "Room", category: "Room", shape: "rect", w: 40, h: 30, fill: "none", outline: true },
  { kind: "circle", label: "Circle", category: "Shapes & text", shape: "circle", w: 6, h: 6, fill: "#dfe6ee" },
  { kind: "rectangle", label: "Rectangle", category: "Shapes & text", shape: "rect", w: 8, h: 5, fill: "#dfe6ee" },
  { kind: "text", label: "Text", category: "Shapes & text", shape: "text", w: 10, h: 2, fill: "none" },
];

export const CATALOG_BY_KIND: Record<string, ElementSpec> = Object.fromEntries(
  ELEMENT_CATALOG.map((s) => [s.kind, s]),
);

export type FloorPlanElement = {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  label: string;
  fill: string;
  seats: number;
  locked: boolean;
  /** Text size in feet (text elements only). */
  fontFt: number;
};

export type FloorPlanBlueprint = {
  path: string;
  fileName: string;
  /** Natural size in image pixels. */
  naturalW: number;
  naturalH: number;
  /** Feet per image pixel (set by the scale tool). */
  ftPerPx: number;
  opacity: number;
};

export type FloorPlanData = {
  widthFt: number;
  heightFt: number;
  showGrid: boolean;
  elements: FloorPlanElement[];
  blueprint: FloorPlanBlueprint | null;
};

export const DEFAULT_PLAN_DATA: FloorPlanData = {
  widthFt: 80,
  heightFt: 50,
  showGrid: true,
  elements: [],
  blueprint: null,
};

export const MAX_ELEMENTS = 600;
export const MAX_DIM_FT = 600;

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : "";

const KINDS = new Set<string>(ELEMENT_CATALOG.map((s) => s.kind));

/** Defensive parse of whatever JSON is stored (or posted) into valid plan data. */
export function sanitizePlanData(raw: unknown): FloorPlanData {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const elements: FloorPlanElement[] = [];
  const list = Array.isArray(src.elements) ? src.elements : [];
  const seen = new Set<string>();
  for (const item of list.slice(0, MAX_ELEMENTS)) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const kind = typeof e.kind === "string" && KINDS.has(e.kind) ? (e.kind as ElementKind) : null;
    if (!kind) continue;
    const spec = CATALOG_BY_KIND[kind];
    let id = str(e.id, 40) || `e${elements.length}`;
    if (seen.has(id)) id = `${id}_${elements.length}`;
    seen.add(id);
    elements.push({
      id,
      kind,
      x: clamp(num(e.x, 0), -MAX_DIM_FT, MAX_DIM_FT),
      y: clamp(num(e.y, 0), -MAX_DIM_FT, MAX_DIM_FT),
      w: clamp(num(e.w, spec.w), 0.2, MAX_DIM_FT),
      h: clamp(num(e.h, spec.h), 0.2, MAX_DIM_FT),
      rot: ((num(e.rot, 0) % 360) + 360) % 360,
      label: str(e.label, 120),
      fill: /^#[0-9a-fA-F]{6}$/.test(String(e.fill)) || e.fill === "none" ? String(e.fill) : spec.fill,
      seats: clamp(Math.round(num(e.seats, spec.seats ?? 0)), 0, 24),
      locked: e.locked === true,
      fontFt: clamp(num(e.fontFt, 1.2), 0.3, 20),
    });
  }

  let blueprint: FloorPlanBlueprint | null = null;
  const bp = src.blueprint as Record<string, unknown> | null | undefined;
  if (bp && typeof bp === "object" && typeof bp.path === "string" && bp.path) {
    blueprint = {
      path: bp.path.slice(0, 300),
      fileName: str(bp.fileName, 200),
      naturalW: clamp(num(bp.naturalW, 1000), 1, 20000),
      naturalH: clamp(num(bp.naturalH, 1000), 1, 20000),
      ftPerPx: clamp(num(bp.ftPerPx, 0.05), 0.0001, 100),
      opacity: clamp(num(bp.opacity, 0.6), 0.05, 1),
    };
  }

  return {
    widthFt: clamp(num(src.widthFt, DEFAULT_PLAN_DATA.widthFt), 5, MAX_DIM_FT),
    heightFt: clamp(num(src.heightFt, DEFAULT_PLAN_DATA.heightFt), 5, MAX_DIM_FT),
    showGrid: src.showGrid !== false,
    elements,
    blueprint,
  };
}

export function newElement(kind: ElementKind, x: number, y: number, id: string): FloorPlanElement {
  const spec = CATALOG_BY_KIND[kind];
  return {
    id,
    kind,
    x,
    y,
    w: spec.w,
    h: spec.h,
    rot: 0,
    label: kind === "text" ? "Text" : "",
    fill: spec.fill,
    seats: spec.seats ?? 0,
    locked: false,
    fontFt: 1.2,
  };
}

/** Blueprint size in feet. */
export function blueprintSizeFt(bp: FloorPlanBlueprint) {
  return { w: bp.naturalW * bp.ftPerPx, h: bp.naturalH * bp.ftPerPx };
}

/** New feet-per-pixel after the user marks two points `measuredFt` apart on the plan and says it is `realFt`. */
export function recalibrate(bp: FloorPlanBlueprint, measuredFt: number, realFt: number): number | null {
  if (!(measuredFt > 0) || !(realFt > 0)) return null;
  return bp.ftPerPx * (realFt / measuredFt);
}

export type Pt = { x: number; y: number };

export function rotatePoint(p: Pt, center: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export type Shape =
  | { type: "poly"; points: Pt[]; fill: string; stroke: string; strokeFt: number; dash?: boolean }
  | { type: "circle"; cx: number; cy: number; r: number; fill: string; stroke: string; strokeFt: number };

const STROKE = "#2b2b2b";
const CHAIR = "#4a90d9";

function rectPoints(cx: number, cy: number, w: number, h: number, rot: number): Pt[] {
  const c = { x: cx, y: cy };
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ].map((p) => rotatePoint(p, c, rot));
}

function ellipsePoints(cx: number, cy: number, w: number, h: number, rot: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push(rotatePoint({ x: cx + (Math.cos(a) * w) / 2, y: cy + (Math.sin(a) * h) / 2 }, { x: cx, y: cy }, rot));
  }
  return pts;
}

const CHAIR_FT = 1.5;
const CHAIR_GAP = 0.25;

/** Chair positions (center) around a table, in absolute feet. */
export function seatPositions(el: FloorPlanElement): Pt[] {
  const n = el.seats;
  if (n <= 0) return [];
  const c = { x: el.x, y: el.y };
  const out: Pt[] = [];
  const spec = CATALOG_BY_KIND[el.kind];
  if (spec?.shape === "circle") {
    const rx = el.w / 2 + CHAIR_FT / 2 + CHAIR_GAP;
    const ry = el.h / 2 + CHAIR_FT / 2 + CHAIR_GAP;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      out.push(rotatePoint({ x: el.x + Math.cos(a) * rx, y: el.y + Math.sin(a) * ry }, c, el.rot));
    }
    return out;
  }
  // Rectangular: seats along the two long sides.
  const top = Math.ceil(n / 2);
  const bottom = n - top;
  const place = (count: number, side: -1 | 1) => {
    for (let i = 0; i < count; i++) {
      const lx = el.x - el.w / 2 + ((i + 0.5) * el.w) / count;
      const ly = el.y + side * (el.h / 2 + CHAIR_FT / 2 + CHAIR_GAP);
      out.push(rotatePoint({ x: lx, y: ly }, c, el.rot));
    }
  };
  place(top, -1);
  place(bottom, 1);
  return out;
}

/** Everything needed to draw one element, in absolute feet. */
export function shapesFor(el: FloorPlanElement): Shape[] {
  const spec = CATALOG_BY_KIND[el.kind];
  if (!spec || spec.shape === "text") return [];
  const shapes: Shape[] = [];
  for (const p of seatPositions(el)) {
    shapes.push({ type: "circle", cx: p.x, cy: p.y, r: CHAIR_FT / 2, fill: CHAIR, stroke: STROKE, strokeFt: 0.08 });
  }
  const outline = spec.outline === true;
  const fill = outline ? "none" : el.fill;
  const strokeFt = el.kind === "wall" ? 0.05 : outline ? 0.4 : 0.1;
  if (spec.shape === "circle" && Math.abs(el.w - el.h) < 0.001) {
    shapes.push({ type: "circle", cx: el.x, cy: el.y, r: el.w / 2, fill, stroke: STROKE, strokeFt });
  } else if (spec.shape === "circle") {
    shapes.push({ type: "poly", points: ellipsePoints(el.x, el.y, el.w, el.h, el.rot), fill, stroke: STROKE, strokeFt });
  } else {
    shapes.push({ type: "poly", points: rectPoints(el.x, el.y, el.w, el.h, el.rot), fill, stroke: STROKE, strokeFt });
  }
  return shapes;
}

/** Axis-aligned bounds of an element including its chairs. */
export function elementBounds(el: FloorPlanElement) {
  const xs: number[] = [];
  const ys: number[] = [];
  const spec = CATALOG_BY_KIND[el.kind];
  if (spec?.shape === "text") {
    xs.push(el.x - el.w / 2, el.x + el.w / 2);
    ys.push(el.y - el.h / 2, el.y + el.h / 2);
  }
  for (const s of shapesFor(el)) {
    if (s.type === "circle") {
      xs.push(s.cx - s.r, s.cx + s.r);
      ys.push(s.cy - s.r, s.cy + s.r);
    } else {
      for (const p of s.points) {
        xs.push(p.x);
        ys.push(p.y);
      }
    }
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** What the plan needs: counts per item and total seats (the "Inventory" list). */
export function planInventory(data: FloorPlanData): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  let chairs = 0;
  for (const el of data.elements) {
    const spec = CATALOG_BY_KIND[el.kind];
    if (!spec || el.kind === "text" || el.kind === "wall" || el.kind === "room") continue;
    counts.set(spec.label, (counts.get(spec.label) ?? 0) + 1);
    chairs += el.seats;
  }
  const rows = [...counts.entries()].map(([label, count]) => ({ label, count }));
  if (chairs > 0) rows.push({ label: "Seats at tables", count: chairs });
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

export function snap(n: number, step: number | null): number {
  if (!step) return n;
  return Math.round(n / step) * step;
}
