"use client";

import { useRef, useState } from "react";

/**
 * Pinch-to-zoom and drag-to-pan for any content (floor plans). Two fingers zoom, one finger or
 * mouse drag pans, the wheel zooms on desktop, double-tap resets.
 */
export function ZoomPan({ children, className }: { children: React.ReactNode; className?: string }) {
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const lastTap = useRef(0);

  function metrics() {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  }

  function clampK(k: number) {
    return Math.min(8, Math.max(0.5, k));
  }

  return (
    <div
      className={className}
      style={{ touchAction: "none", overflow: "hidden", cursor: "grab" }}
      onWheel={(e) => {
        e.preventDefault?.();
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        setT((p) => {
          const k = clampK(p.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
          const r = k / p.k;
          return { k, x: px - (px - p.x) * r, y: py - (py - p.y) * r };
        });
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        last.current = metrics();
        const now = Date.now();
        if (pointers.current.size === 1) {
          if (now - lastTap.current < 300) setT({ x: 0, y: 0, k: 1 });
          lastTap.current = now;
        }
      }}
      onPointerMove={(e) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        const rect = e.currentTarget.getBoundingClientRect();
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size >= 2) {
          const m = metrics();
          if (m && last.current && last.current.dist > 0) {
            const lm = last.current;
            setT((p) => {
              const k = clampK(p.k * (m.dist / lm.dist));
              const r = k / p.k;
              const px = lm.cx - rect.left;
              const py = lm.cy - rect.top;
              return {
                k,
                x: px - (px - p.x) * r + (m.cx - lm.cx),
                y: py - (py - p.y) * r + (m.cy - lm.cy),
              };
            });
          }
          last.current = m;
        } else {
          setT((p) => ({ ...p, x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) }));
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        last.current = metrics();
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        last.current = metrics();
      }}
    >
      <div style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transformOrigin: "0 0" }}>
        {children}
      </div>
    </div>
  );
}
