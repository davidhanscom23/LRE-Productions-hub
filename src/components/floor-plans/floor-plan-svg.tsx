"use client";

import {
  CATALOG_BY_KIND,
  blueprintSizeFt,
  shapesFor,
  type FloorPlanData,
  type FloorPlanElement,
} from "@/lib/floor-plans/types";

type Props = {
  data: FloorPlanData;
  blueprintUrl?: string | null;
  selectedIds?: ReadonlySet<string>;
  /** Extra SVG drawn on top (editor handles, calibration marks). */
  overlay?: React.ReactNode;
  svgRef?: React.Ref<SVGSVGElement>;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onElementPointerDown?: (e: React.PointerEvent, el: FloorPlanElement) => void;
  className?: string;
  style?: React.CSSProperties;
};

const pts = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(" ");

function ElementShapes({ el }: { el: FloorPlanElement }) {
  const spec = CATALOG_BY_KIND[el.kind];
  if (spec?.shape === "text") {
    return (
      <text
        x={el.x}
        y={el.y}
        fontSize={el.fontFt}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#111"
        transform={`rotate(${el.rot} ${el.x} ${el.y})`}
        style={{ userSelect: "none" }}
      >
        {el.label}
      </text>
    );
  }
  const labelSize = Math.max(0.6, Math.min(1.2, Math.min(el.w, el.h) / 4));
  const showLabel = el.label && el.kind !== "wall" && el.kind !== "door";
  return (
    <>
      {shapesFor(el).map((s, i) =>
        s.type === "circle" ? (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeFt} />
        ) : (
          <polygon key={i} points={pts(s.points)} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeFt} />
        ),
      )}
      {showLabel && (
        <text
          x={el.x}
          y={el.y}
          fontSize={labelSize}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#111"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {el.label}
        </text>
      )}
    </>
  );
}

export function FloorPlanSvg({
  data,
  blueprintUrl,
  selectedIds,
  overlay,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onElementPointerDown,
  className,
  style,
}: Props) {
  const { widthFt: W, heightFt: H } = data;
  const bp = data.blueprint;
  const bpSize = bp ? blueprintSizeFt(bp) : null;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ touchAction: "none", background: "#fff", ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <rect x={0} y={0} width={W} height={H} fill="#fff" />
      {bp && blueprintUrl && bpSize && (
        <image
          href={blueprintUrl}
          x={0}
          y={0}
          width={bpSize.w}
          height={bpSize.h}
          opacity={bp.opacity}
          preserveAspectRatio="none"
          style={{ pointerEvents: "none" }}
        />
      )}
      {data.showGrid && (
        <g style={{ pointerEvents: "none" }}>
          {Array.from({ length: Math.floor(W / 5) + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * 5} y1={0} x2={i * 5} y2={H} stroke="#d5dbe3" strokeWidth={i % 2 === 0 ? 0.08 : 0.04} />
          ))}
          {Array.from({ length: Math.floor(H / 5) + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 5} x2={W} y2={i * 5} stroke="#d5dbe3" strokeWidth={i % 2 === 0 ? 0.08 : 0.04} />
          ))}
        </g>
      )}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="#8a94a3" strokeWidth={0.2} style={{ pointerEvents: "none" }} />
      {data.elements.map((el) => (
        <g
          key={el.id}
          onPointerDown={onElementPointerDown ? (e) => onElementPointerDown(e, el) : undefined}
          style={{ cursor: onElementPointerDown ? (el.locked ? "default" : "move") : undefined }}
        >
          <ElementShapes el={el} />
          {selectedIds?.has(el.id) && (
            <rect
              x={el.x - el.w / 2 - 0.3}
              y={el.y - el.h / 2 - 0.3}
              width={el.w + 0.6}
              height={el.h + 0.6}
              fill="none"
              stroke="#2563eb"
              strokeWidth={0.18}
              strokeDasharray="0.6 0.4"
              transform={`rotate(${el.rot} ${el.x} ${el.y})`}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      ))}
      {overlay}
    </svg>
  );
}
