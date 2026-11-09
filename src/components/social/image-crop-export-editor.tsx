"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Download, Move, RotateCcw, Save } from "lucide-react";
import { saveCroppedPacketImageAction } from "@/app/(app)/social-studio/actions";
import {
  computeCoverCropDraw,
  cropImageToDataUrl,
  downloadDataUrl,
  type CoverCropOptions,
} from "@/lib/social/crop-image";
import {
  PLATFORM_IMAGE_FORMATS,
  SOCIAL_PLATFORM_LABELS,
  type PlatformImageFormat,
} from "@/lib/social/platforms";

type ImageCropExportEditorProps = {
  packetId: string;
  sourceUrl: string | null;
  fileName: string;
  onSaved?: (message: string) => void;
  onError?: (message: string) => void;
};

type StageSize = { w: number; h: number };

type CropFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Fit the export aspect ratio inside the stage with padding. */
function fitCropFrame(
  stage: StageSize,
  format: PlatformImageFormat,
  pad = 28,
): CropFrame {
  const maxW = Math.max(80, stage.w - pad * 2);
  const maxH = Math.max(80, stage.h - pad * 2);
  const aspect = format.width / format.height;
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return {
    width,
    height,
    left: (stage.w - width) / 2,
    top: (stage.h - height) / 2,
  };
}

export function ImageCropExportEditor({
  packetId,
  sourceUrl,
  fileName,
  onSaved,
  onError,
}: ImageCropExportEditorProps) {
  const [formatId, setFormatId] = useState(PLATFORM_IMAGE_FORMATS[0]!.id);
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState<"download" | "save" | null>(null);
  const [pending, startTransition] = useTransition();

  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originFocusX: number;
    originFocusY: number;
  } | null>(null);

  const format =
    PLATFORM_IMAGE_FORMATS.find((row) => row.id === formatId) ??
    PLATFORM_IMAGE_FORMATS[0]!;

  useEffect(() => {
    if (!sourceUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      if (!cancelled) setNatural(null);
    };
    img.src = sourceUrl;
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  const cropOptions: CoverCropOptions = { focusX, focusY, zoom };

  function clampFocus(
    nextFocusX: number,
    nextFocusY: number,
    nextZoom = zoom,
    nextFormat = format,
  ) {
    const el = stageRef.current;
    if (!el || !natural) {
      return { focusX: nextFocusX, focusY: nextFocusY };
    }
    const frame = fitCropFrame(
      { w: el.clientWidth || 480, h: el.clientHeight || 420 },
      nextFormat,
    );
    const { dx, dy, scale } = computeCoverCropDraw(
      natural.w,
      natural.h,
      frame.width,
      frame.height,
      { focusX: nextFocusX, focusY: nextFocusY, zoom: nextZoom },
    );
    return {
      focusX: (frame.width / 2 - dx) / (natural.w * scale),
      focusY: (frame.height / 2 - dy) / (natural.h * scale),
    };
  }

  function resetCrop() {
    const clamped = clampFocus(0.5, 0.5, 1);
    setFocusX(clamped.focusX);
    setFocusY(clamped.focusY);
    setZoom(1);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!sourceUrl || !natural) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originFocusX: focusX,
      originFocusY: focusY,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !natural) return;
    const el = stageRef.current;
    if (!el) return;
    const frame = fitCropFrame(
      { w: el.clientWidth || 480, h: el.clientHeight || 420 },
      format,
    );

    const coverScale =
      Math.max(frame.width / natural.w, frame.height / natural.h) *
      Math.max(1, zoom);

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const tentativeX = drag.originFocusX - deltaX / (natural.w * coverScale);
    const tentativeY = drag.originFocusY - deltaY / (natural.h * coverScale);
    const clamped = clampFocus(tentativeX, tentativeY);
    setFocusX(clamped.focusX);
    setFocusY(clamped.focusY);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  async function buildCrop() {
    if (!sourceUrl) throw new Error("Select a photo first.");
    return cropImageToDataUrl(
      sourceUrl,
      format.width,
      format.height,
      cropOptions,
    );
  }

  async function handleDownload() {
    setBusy("download");
    try {
      const dataUrl = await buildCrop();
      const base = fileName.replace(/\.[^.]+$/, "") || "export";
      downloadDataUrl(
        dataUrl,
        `${base}-${format.id}-${format.width}x${format.height}.jpg`,
      );
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  function handleSaveToPacket() {
    setBusy("save");
    startTransition(async () => {
      try {
        const dataUrl = await buildCrop();
        const result = await saveCroppedPacketImageAction({
          packetId,
          imageDataUrl: dataUrl,
          formatId: format.id,
          formatLabel: format.label,
        });
        if (result.error) {
          onError?.(result.error);
          return;
        }
        onSaved?.(
          `Saved crop as ${result.fileName ?? "packet image"} — pick it in Marketing Queue to post this framing.`,
        );
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Could not save crop.");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Export size
          </span>
          <select
            value={format.id}
            onChange={(event) => {
              const nextId = event.target.value;
              const nextFormat =
                PLATFORM_IMAGE_FORMATS.find((row) => row.id === nextId) ??
                PLATFORM_IMAGE_FORMATS[0]!;
              setFormatId(nextId);
              const clamped = clampFocus(focusX, focusY, zoom, nextFormat);
              setFocusX(clamped.focusX);
              setFocusY(clamped.focusY);
            }}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          >
            {PLATFORM_IMAGE_FORMATS.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
          <span className="block text-xs text-[var(--muted)]">
            {format.platforms.map((p) => SOCIAL_PLATFORM_LABELS[p]).join(" · ")}
          </span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--foreground)]">
            Zoom {zoom.toFixed(2)}×
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              setZoom(nextZoom);
              const clamped = clampFocus(focusX, focusY, nextZoom);
              setFocusX(clamped.focusX);
              setFocusY(clamped.focusY);
            }}
            disabled={!sourceUrl}
            className="mt-2 w-full accent-[var(--brand)]"
          />
          <span className="block text-xs text-[var(--muted)]">
            Drag the photo under the crop box. Dimmed areas are cut off.
          </span>
        </label>
      </div>

      <CropStage
        stageRef={stageRef}
        sourceUrl={sourceUrl}
        natural={natural}
        format={format}
        options={cropOptions}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!sourceUrl || Boolean(busy) || pending}
          onClick={handleDownload}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {busy === "download" ? "Preparing…" : "Download crop"}
        </button>
        <button
          type="button"
          disabled={!sourceUrl || Boolean(busy) || pending}
          onClick={handleSaveToPacket}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {busy === "save" || pending ? "Saving…" : "Save crop to packet"}
        </button>
        <button
          type="button"
          disabled={!sourceUrl || Boolean(busy)}
          onClick={resetCrop}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Only the bright area inside the crop box is exported. Marketing Queue
        posts packet media as-is — save a crop to the packet when you want that
        framing available for posting.
      </p>
    </div>
  );
}

function CropStage({
  stageRef,
  sourceUrl,
  natural,
  format,
  options,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  sourceUrl: string | null;
  natural: { w: number; h: number } | null;
  format: PlatformImageFormat;
  options: CoverCropOptions;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const [stage, setStage] = useState<StageSize>({ w: 480, h: 420 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      setStage({
        w: el.clientWidth || 480,
        h: el.clientHeight || 420,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stageRef, format.id]);

  const frame = fitCropFrame(stage, format);

  const draw =
    natural && frame.width > 0
      ? computeCoverCropDraw(
          natural.w,
          natural.h,
          frame.width,
          frame.height,
          options,
        )
      : null;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <p className="text-sm font-medium text-[var(--foreground)]">
          Crop frame · {format.width}×{format.height}
        </p>
        <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
          <Move className="h-3.5 w-3.5" />
          Drag photo · box is the export
        </span>
      </div>

      <div
        ref={stageRef}
        className="relative h-[min(28rem,70vh)] w-full touch-none select-none overflow-hidden bg-[var(--surface-hover)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ cursor: sourceUrl && natural ? "grab" : "default" }}
      >
        {/* Full photo (visible under and outside the crop box) */}
        {sourceUrl && draw ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sourceUrl}
            alt="Crop source"
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              width: draw.drawW,
              height: draw.drawH,
              left: frame.left + draw.dx,
              top: frame.top + draw.dy,
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-sm text-[var(--muted)]">
            {sourceUrl ? "Loading crop preview…" : "Select a photo to crop."}
          </div>
        )}

        {/* Explicit crop box: bright hole = export; shadow dims the rest */}
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-white"
          style={{
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            boxShadow: "0 0 0 9999px rgba(15, 15, 18, 0.62)",
          }}
        >
          <div className="absolute -top-7 left-0 rounded bg-black/75 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white">
            Exports this area
          </div>
          {/* Rule-of-thirds guides */}
          <div className="absolute inset-0 opacity-40">
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/70" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/70" />
            <div className="absolute right-0 left-0 top-1/3 h-px bg-white/70" />
            <div className="absolute right-0 left-0 top-2/3 h-px bg-white/70" />
          </div>
        </div>
      </div>
    </div>
  );
}
