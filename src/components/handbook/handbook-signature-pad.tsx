"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HandbookSignaturePadProps = {
  onChange: (hasSigned: boolean, dataUrl: string) => void;
};

export function HandbookSignaturePad({ onChange }: HandbookSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSigned, setHasSigned] = useState(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = 150;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--foreground")
      .trim() || "#111827";
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  function pointFromEvent(event: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point =
      "touches" in event ? event.touches[0] : (event as React.MouseEvent);
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
  }

  function startDraw(event: React.MouseEvent | React.TouchEvent) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawing.current = true;
    const { x, y } = pointFromEvent(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(event: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = pointFromEvent(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSigned) {
      setHasSigned(true);
      onChange(true, canvas.toDataURL("image/png"));
    } else {
      onChange(true, canvas.toDataURL("image/png"));
    }
  }

  function endDraw() {
    drawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    onChange(false, "");
    resizeCanvas();
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
        Signature *
      </p>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <button
        type="button"
        onClick={clearSignature}
        className="mt-1 text-xs text-[var(--muted)] underline-offset-2 hover:underline"
      >
        Clear signature
      </button>
    </div>
  );
}
