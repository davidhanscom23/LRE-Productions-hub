"use client";

import {
  createBlueprintUpload,
  getBlueprintUrl,
  saveAsTemplate,
  saveFloorPlan,
  setFloorPlanPublished,
} from "@/app/(app)/floor-plans/actions";
import { FloorPlanSvg } from "@/components/floor-plans/floor-plan-svg";
import {
  ELEMENT_CATALOG,
  CATALOG_BY_KIND,
  newElement,
  planInventory,
  recalibrate,
  snap,
  type ElementKind,
  type FloorPlanData,
  type FloorPlanElement,
} from "@/lib/floor-plans/types";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  planId: string;
  initialName: string;
  initialSpaceName: string;
  initialData: FloorPlanData;
  isTemplate: boolean;
  initialPublishedUrl: string | null;
  canSaveTemplate: boolean;
  backHref: string;
};

type Pt = { x: number; y: number };
const SNAP = 0.5;
const CATEGORIES = ["Tables & seating", "Stage & AV", "Room", "Shapes & text"] as const;

const btn =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--surface-hover,var(--background))] disabled:opacity-40";
const input =
  "w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm";

let idCounter = 0;
const nextId = () => `e${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export function FloorPlanEditor(props: Props) {
  const { planId, isTemplate } = props;
  const [name, setName] = useState(props.initialName);
  const [spaceName, setSpaceName] = useState(props.initialSpaceName);
  const [data, setData] = useState<FloorPlanData>(props.initialData);
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(14); // px per foot
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(props.initialPublishedUrl);
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);
  const [calibrating, setCalibrating] = useState<Pt[] | null>(null);
  const [calibrateFt, setCalibrateFt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const undoStack = useRef<FloorPlanData[]>([]);
  const redoStack = useRef<FloorPlanData[]>([]);
  const drag = useRef<{ ids: string[]; start: Pt; origin: Map<string, Pt>; moved: boolean } | null>(null);
  const dirtyRef = useRef(false);
  const latest = useRef({ name, spaceName, data });
  useEffect(() => {
    latest.current = { name, spaceName, data };
  }, [name, spaceName, data]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("dirty");
  }, []);

  /** Apply a change and push the previous state to the undo stack. */
  const commit = useCallback(
    (fn: (d: FloorPlanData) => FloorPlanData, opts?: { skipHistory?: boolean }) => {
      setData((prev) => {
        if (!opts?.skipHistory) {
          undoStack.current.push(prev);
          if (undoStack.current.length > 100) undoStack.current.shift();
          redoStack.current = [];
        }
        return fn(prev);
      });
      markDirty();
    },
    [markDirty],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setData((cur) => {
      redoStack.current.push(cur);
      return prev;
    });
    setSelected([]);
    markDirty();
  }, [markDirty]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    setData((cur) => {
      undoStack.current.push(cur);
      return next;
    });
    setSelected([]);
    markDirty();
  }, [markDirty]);

  // Show the private blueprint to staff via a signed URL.
  const blueprintPath = data.blueprint?.path ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!blueprintPath) return;
    getBlueprintUrl(blueprintPath).then((r) => {
      if (!cancelled && r.error === null) setSigned({ path: blueprintPath, url: r.url });
    });
    return () => {
      cancelled = true;
    };
  }, [blueprintPath]);

  const save = useCallback(async () => {
    setSaveState("saving");
    const cur = latest.current;
    dirtyRef.current = false;
    const res = await saveFloorPlan({ id: planId, name: cur.name, spaceName: cur.spaceName, data: cur.data });
    if (res.error) {
      setSaveState("error");
      setSaveError(res.error);
      dirtyRef.current = true;
    } else {
      setSaveError(null);
      setSaveState(dirtyRef.current ? "dirty" : "saved");
    }
  }, [planId]);

  // Autosave 1.5s after the last change.
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
  }, [saveState, data, name, spaceName, save]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const blueprintUrl = signed && signed.path === blueprintPath ? signed.url : null;

  const selectedEls = useMemo(
    () => data.elements.filter((e) => selected.includes(e.id)),
    [data.elements, selected],
  );
  const one = selectedEls.length === 1 ? selectedEls[0] : null;

  const toFeet = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * data.widthFt,
      y: ((e.clientY - r.top) / r.height) * data.heightFt,
    };
  };

  const patchSelected = (patch: Partial<FloorPlanElement>) =>
    commit((d) => ({
      ...d,
      elements: d.elements.map((el) => (selected.includes(el.id) && !el.locked ? { ...el, ...patch } : el)),
    }));

  const addElement = (kind: ElementKind) => {
    const c = { x: snap(data.widthFt / 2, SNAP), y: snap(data.heightFt / 2, SNAP) };
    // Nudge so repeated adds don't stack exactly.
    const off = (data.elements.length % 8) * 1.5;
    const el = newElement(kind, c.x + off, c.y + off, nextId());
    commit((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelected([el.id]);
  };

  const deleteSelected = useCallback(() => {
    commit((d) => ({ ...d, elements: d.elements.filter((e) => !selected.includes(e.id) || e.locked) }));
    setSelected([]);
  }, [commit, selected]);

  const duplicateSelected = useCallback(() => {
    const copies = selectedEls.map((e) => ({ ...e, id: nextId(), x: e.x + 2, y: e.y + 2, locked: false }));
    if (!copies.length) return;
    commit((d) => ({ ...d, elements: [...d.elements, ...copies] }));
    setSelected(copies.map((c) => c.id));
  }, [commit, selectedEls]);

  const reorder = (dir: "front" | "back") =>
    commit((d) => {
      const sel = d.elements.filter((e) => selected.includes(e.id));
      const rest = d.elements.filter((e) => !selected.includes(e.id));
      return { ...d, elements: dir === "front" ? [...rest, ...sel] : [...sel, ...rest] };
    });

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    if (preview) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.length) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key.startsWith("Arrow") && selected.length) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : SNAP;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commit((d) => ({
          ...d,
          elements: d.elements.map((el) => (selected.includes(el.id) && !el.locked ? { ...el, x: el.x + dx, y: el.y + dy } : el)),
        }));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [preview, selected, undo, redo, duplicateSelected, deleteSelected, commit]);

  // ---- pointer handling ----
  const onElementPointerDown = (e: React.PointerEvent, el: FloorPlanElement) => {
    if (preview || calibrating) return;
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    let ids: string[];
    if (additive) {
      ids = selected.includes(el.id) ? selected.filter((i) => i !== el.id) : [...selected, el.id];
    } else {
      ids = selected.includes(el.id) ? selected : [el.id];
    }
    setSelected(ids);
    const movable = data.elements.filter((x) => ids.includes(x.id) && !x.locked);
    if (!movable.length || additive) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    svgRef.current?.setPointerCapture?.(e.pointerId);
    drag.current = {
      ids: movable.map((m) => m.id),
      start: toFeet(e),
      origin: new Map(movable.map((m) => [m.id, { x: m.x, y: m.y }])),
      moved: false,
    };
  };

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (preview) return;
    if (calibrating) {
      const p = toFeet(e);
      setCalibrating((c) => (c && c.length < 2 ? [...c, p] : c));
      return;
    }
    setSelected([]);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toFeet(e);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    if (!d.moved && Math.hypot(dx, dy) < 0.2) return;
    if (!d.moved) {
      undoStack.current.push(latest.current.data);
      redoStack.current = [];
      d.moved = true;
    }
    setData((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        const o = d.origin.get(el.id);
        return o ? { ...el, x: snap(o.x + dx, SNAP), y: snap(o.y + dy, SNAP) } : el;
      }),
    }));
  };

  const onSvgPointerUp = () => {
    if (drag.current?.moved) markDirty();
    drag.current = null;
  };

  // ---- blueprint ----
  const uploadBlueprint = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const upFile = file;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        setMessage("Blueprints must be PNG, JPG or WebP. For a PDF, export or screenshot the page as an image first.");
        return;
      }
      const bmp = await createImageBitmap(upFile);
      const naturalW = bmp.width;
      const naturalH = bmp.height;
      bmp.close?.();
      const up = await createBlueprintUpload({ planId, fileName: file.name, contentType: upFile.type });
      if (up.error !== null) {
        setMessage(up.error);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("floor-plan-blueprints")
        .uploadToSignedUrl(up.path, up.token, upFile, { contentType: upFile.type, cacheControl: "31536000" });
      if (error) {
        setMessage(error.message);
        return;
      }
      // Start at ~ canvas width so it is visible; the scale tool sets the true size.
      const ftPerPx = data.widthFt / naturalW;
      commit((d) => ({
        ...d,
        blueprint: { path: up.path, fileName: file.name, naturalW, naturalH, ftPerPx, opacity: 0.6 },
      }));
      setMessage("Blueprint added. Use “Set scale” and click two points a known distance apart.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const applyCalibration = () => {
    if (!calibrating || calibrating.length < 2 || !data.blueprint) return;
    const measured = Math.hypot(calibrating[1].x - calibrating[0].x, calibrating[1].y - calibrating[0].y);
    const next = recalibrate(data.blueprint, measured, Number(calibrateFt));
    if (!next) {
      setMessage("Enter the real distance in feet (a number above 0).");
      return;
    }
    const bp = data.blueprint;
    commit((d) => ({ ...d, blueprint: d.blueprint ? { ...d.blueprint, ftPerPx: next } : d.blueprint }));
    setCalibrating(null);
    setCalibrateFt("");
    setMessage(`Scale set. The blueprint is now ${(bp.naturalW * next).toFixed(1)} ft wide.`);
  };

  // ---- publish / template ----
  const togglePublish = async () => {
    setBusy(true);
    if (dirtyRef.current) await save();
    const res = await setFloorPlanPublished(planId, !publishedUrl);
    setBusy(false);
    if (res.error !== null) setMessage(res.error);
    else {
      setPublishedUrl(res.url);
      setMessage(res.url ? "Published. Copy the link to send it to your client." : "Unpublished. The client link no longer works.");
    }
  };

  const copyLink = async () => {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setMessage("Link copied.");
    } catch {
      setMessage(publishedUrl);
    }
  };

  const makeTemplate = async () => {
    const tname = window.prompt("Template name?", name);
    if (!tname) return;
    setBusy(true);
    if (dirtyRef.current) await save();
    const res = await saveAsTemplate(planId, tname);
    setBusy(false);
    setMessage(res.error ? res.error : "Saved as a template (without the blueprint image).");
  };

  const q = search.trim().toLowerCase();
  const palette = ELEMENT_CATALOG.filter((s) => !q || s.label.toLowerCase().includes(q));
  const inventory = useMemo(() => planInventory(data), [data]);

  const overlay = calibrating ? (
    <g style={{ pointerEvents: "none" }}>
      {calibrating.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={0.7} fill="#dc2626" />
      ))}
      {calibrating.length === 2 && (
        <line x1={calibrating[0].x} y1={calibrating[0].y} x2={calibrating[1].x} y2={calibrating[1].y} stroke="#dc2626" strokeWidth={0.25} />
      )}
    </g>
  ) : null;

  const statusText =
    saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "error" ? `Save failed: ${saveError}` : "All changes saved";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href={props.backHref} className={btn}>
          ← Back
        </a>
        <input
          className={`${input} max-w-xs font-semibold`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            markDirty();
          }}
          aria-label="Plan name"
        />
        <input
          className={`${input} max-w-[12rem]`}
          value={spaceName}
          placeholder="Space (e.g. Ballroom)"
          onChange={(e) => {
            setSpaceName(e.target.value);
            markDirty();
          }}
          aria-label="Space name"
        />
        <span className={`text-xs ${saveState === "error" ? "text-red-600" : "text-[var(--muted)]"}`}>{statusText}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button className={btn} onClick={undo} disabled={preview}>Undo</button>
          <button className={btn} onClick={redo} disabled={preview}>Redo</button>
          <button className={btn} onClick={() => setZoom((z) => Math.max(4, z - 2))}>−</button>
          <button className={btn} onClick={() => setZoom((z) => Math.min(40, z + 2))}>+</button>
          <button className={btn} onClick={() => { setPreview((p) => !p); setSelected([]); }}>
            {preview ? "Back to editing" : "Preview"}
          </button>
          <button className={btn} onClick={() => void save()} disabled={saveState === "saving"}>Save</button>
          <a className={btn} href={`/api/floor-plans/${planId}/pdf`} target="_blank" rel="noreferrer">PDF</a>
          {!isTemplate && (
            <button className={btn} onClick={togglePublish} disabled={busy}>
              {publishedUrl ? "Unpublish" : "Publish to client"}
            </button>
          )}
          {publishedUrl && <button className={btn} onClick={copyLink}>Copy client link</button>}
          {props.canSaveTemplate && !isTemplate && (
            <button className={btn} onClick={makeTemplate} disabled={busy}>Save as template</button>
          )}
        </div>
      </div>
      {message && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">{message}</p>
      )}

      <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_240px]">
        {!preview && (
          <aside className="flex max-h-[75vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <input className={input} placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
            {CATEGORIES.map((cat) => {
              const items = palette.filter((s) => s.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{cat}</p>
                  <div className="flex flex-col gap-1">
                    {items.map((s) => (
                      <button key={s.kind} className={`${btn} text-left`} onClick={() => addElement(s.kind)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </aside>
        )}

        <div className={`overflow-auto rounded-2xl border border-[var(--border)] bg-white ${preview ? "lg:col-span-2" : ""}`} style={{ maxHeight: "75vh" }}>
          <FloorPlanSvg
            data={data}
            blueprintUrl={blueprintUrl}
            selectedIds={preview ? undefined : new Set(selected)}
            svgRef={svgRef}
            overlay={overlay}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onElementPointerDown={preview ? undefined : onElementPointerDown}
            style={{ width: data.widthFt * zoom, height: data.heightFt * zoom, display: "block" }}
          />
        </div>

        <aside className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
          {!preview && one && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {CATALOG_BY_KIND[one.kind]?.label}
              </p>
              <label className="text-xs">Label
                <input className={input} value={one.label} onChange={(e) => patchSelected({ label: e.target.value.slice(0, 120) })} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Width (ft)
                  <input className={input} type="number" min={0.2} step={0.5} value={one.w} onChange={(e) => patchSelected({ w: Math.max(0.2, Number(e.target.value) || 0.2) })} />
                </label>
                <label className="text-xs">Depth (ft)
                  <input className={input} type="number" min={0.2} step={0.5} value={one.h} onChange={(e) => patchSelected({ h: Math.max(0.2, Number(e.target.value) || 0.2) })} />
                </label>
                <label className="text-xs">Rotate (°)
                  <input className={input} type="number" step={15} value={one.rot} onChange={(e) => patchSelected({ rot: ((Number(e.target.value) || 0) % 360 + 360) % 360 })} />
                </label>
                {CATALOG_BY_KIND[one.kind]?.seats !== undefined && (
                  <label className="text-xs">Seats
                    <input className={input} type="number" min={0} max={24} value={one.seats} onChange={(e) => patchSelected({ seats: Math.max(0, Math.min(24, Math.round(Number(e.target.value) || 0))) })} />
                  </label>
                )}
                {one.kind === "text" && (
                  <label className="text-xs">Text size (ft)
                    <input className={input} type="number" min={0.3} step={0.2} value={one.fontFt} onChange={(e) => patchSelected({ fontFt: Math.max(0.3, Number(e.target.value) || 1) })} />
                  </label>
                )}
              </div>
              {CATALOG_BY_KIND[one.kind]?.fill !== "none" && one.kind !== "text" && (
                <label className="text-xs">Color
                  <input className="block h-8 w-full" type="color" value={/^#[0-9a-f]{6}$/i.test(one.fill) ? one.fill : "#cccccc"} onChange={(e) => patchSelected({ fill: e.target.value })} />
                </label>
              )}
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={one.locked} onChange={(e) => commit((d) => ({ ...d, elements: d.elements.map((x) => (x.id === one.id ? { ...x, locked: e.target.checked } : x)) }))} />
                Locked (can’t move or edit)
              </label>
            </div>
          )}
          {!preview && selectedEls.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button className={btn} onClick={duplicateSelected}>Duplicate</button>
              <button className={btn} onClick={() => reorder("front")}>Bring forward</button>
              <button className={btn} onClick={() => reorder("back")}>Send back</button>
              <button className={`${btn} text-red-600`} onClick={deleteSelected}>Delete</button>
            </div>
          )}
          {!preview && selectedEls.length === 0 && (
            <p className="text-xs text-[var(--muted)]">Click an item on the left to add it, then drag it into place. Shift-click to select several. Arrow keys nudge; Ctrl/⌘-Z undoes.</p>
          )}

          {!preview && (
            <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Room</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Width (ft)
                  <input className={input} type="number" min={5} max={600} value={data.widthFt} onChange={(e) => commit((d) => ({ ...d, widthFt: Math.max(5, Math.min(600, Number(e.target.value) || 5)) }))} />
                </label>
                <label className="text-xs">Length (ft)
                  <input className={input} type="number" min={5} max={600} value={data.heightFt} onChange={(e) => commit((d) => ({ ...d, heightFt: Math.max(5, Math.min(600, Number(e.target.value) || 5)) }))} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={data.showGrid} onChange={(e) => commit((d) => ({ ...d, showGrid: e.target.checked }))} />
                Show 5 ft grid
              </label>
            </div>
          )}

          {!preview && (
            <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Blueprint</p>
              <label className={`${btn} cursor-pointer text-center`}>
                {data.blueprint ? "Replace image" : "Upload blueprint image"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy || isTemplate} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadBlueprint(f); e.target.value = ""; }} />
              </label>
              {isTemplate && <p className="text-xs text-[var(--muted)]">Templates don’t carry a blueprint.</p>}
              {data.blueprint && (
                <>
                  <label className="text-xs">Opacity
                    <input className="w-full" type="range" min={0.1} max={1} step={0.05} value={data.blueprint.opacity} onChange={(e) => commit((d) => ({ ...d, blueprint: d.blueprint ? { ...d.blueprint, opacity: Number(e.target.value) } : null }))} />
                  </label>
                  {calibrating ? (
                    <div className="flex flex-col gap-1.5 text-xs">
                      <p>{calibrating.length < 2 ? `Click point ${calibrating.length + 1} of 2 on the plan.` : "Enter the real distance between the points."}</p>
                      <input className={input} type="number" min={0} step={0.5} placeholder="Distance in feet" value={calibrateFt} onChange={(e) => setCalibrateFt(e.target.value)} />
                      <div className="flex gap-1.5">
                        <button className={btn} onClick={applyCalibration} disabled={calibrating.length < 2}>Apply scale</button>
                        <button className={btn} onClick={() => { setCalibrating(null); setCalibrateFt(""); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className={btn} onClick={() => { setSelected([]); setCalibrating([]); }}>Set scale</button>
                  )}
                  <button className={`${btn} text-red-600`} onClick={() => commit((d) => ({ ...d, blueprint: null }))}>Remove blueprint</button>
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Plan contents</p>
            {inventory.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">Nothing placed yet.</p>
            ) : (
              <ul className="text-xs">
                {inventory.map((r) => (
                  <li key={r.label} className="flex justify-between">
                    <span>{r.label}</span>
                    <span className="tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
