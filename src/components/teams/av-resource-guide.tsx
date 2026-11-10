"use client";

import { useId, useState } from "react";
import {
  BookOpen,
  Cable,
  ChevronDown,
  Droplets,
  Lightbulb,
  Mic,
  Network,
  Radio,
  Wind,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { AV_GUIDE_BRAND_VARS } from "@/lib/teams/department-meta";

/*
 * Fundamental Resource Guide for the AV team.
 * All copy lives in data structures and renders through {expressions} so the
 * text is never a raw JSX node (keeps apostrophes/quotes lint-clean).
 */

// ---------------------------------------------------------------------------
// Reusable presentational primitives
// ---------------------------------------------------------------------------

function Banner({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border-b-4 border-[var(--brand)]/40 bg-gradient-to-br from-[var(--brand)] to-[#7f1d1d] px-5 py-6 text-white sm:px-7 sm:py-8">
      <h3 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-1 max-w-3xl text-sm text-white/85 italic sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
      {children}
    </p>
  );
}

type Card = { title: string; lines: string[] };

function CardRow({ cards, cols = 3 }: { cards: Card[]; cols?: 2 | 3 | 4 }) {
  const grid =
    cols === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : cols === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-3 ${grid}`}>
      {cards.map((c) => (
        <div
          key={c.title}
          className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
        >
          <div className="flex h-24 items-center justify-center border-b border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3">
            <ConnectorGlyph title={c.title} />
          </div>
          <div className="px-4 pt-2.5 pb-2">
            <p className="font-semibold text-[var(--foreground)]">{c.title}</p>
          </div>
          <div className="space-y-0.5 bg-[var(--brand)] px-4 py-2.5 text-sm text-white">
            {c.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type Pillar = { title: string; tag?: string; lines: string[] };

function Pillars({ items, cols = 3 }: { items: Pillar[]; cols?: 2 | 3 | 4 }) {
  const grid =
    cols === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : cols === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid gap-3 ${grid}`}>
      {items.map((p) => (
        <div
          key={p.title}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
        >
          <p className="text-sm font-bold tracking-wide text-[var(--foreground)] uppercase">
            {p.title}
          </p>
          {p.tag ? (
            <p className="mt-0.5 text-xs font-semibold text-[var(--brand)]">
              {p.tag}
            </p>
          ) : null}
          <div className="mt-2 space-y-1.5">
            {p.lines.map((l) => (
              <p key={l} className="text-sm text-[var(--muted)]">
                {l}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="bg-[var(--brand)] text-white">
            {head.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r[0] + i}
              className={
                i % 2 === 0
                  ? "bg-[var(--surface)]"
                  : "bg-[var(--surface-hover)]"
              }
            >
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`border-t border-[var(--border)] px-3 py-2 ${
                    ci === 0
                      ? "font-medium text-[var(--foreground)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tip({ title = "Pro Tip", body }: { title?: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-4">
      <p className="text-xs font-bold tracking-[0.14em] text-[var(--brand)] uppercase">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--foreground)]">{body}</p>
    </div>
  );
}

/**
 * TIA/EIA-568 wire colors — locked hexes matching the training chart
 * (solid + white/color tip-down split). Only pin colors stay fixed; chrome
 * text uses theme tokens so the chart works on light and dark backgrounds.
 */
const RJ45 = {
  title: "#C41E3A",
  housing: "#000000",
  white: "#FFFFFF",
  green: "#009B4D",
  orange: "#F37021",
  blue: "#0066B3",
  brown: "#63391A",
} as const;

type Rj45Wire =
  | { kind: "solid"; color: string }
  | { kind: "stripe"; color: string };

const T568A_WIRES: Rj45Wire[] = [
  { kind: "stripe", color: RJ45.green },
  { kind: "solid", color: RJ45.green },
  { kind: "stripe", color: RJ45.orange },
  { kind: "solid", color: RJ45.blue },
  { kind: "stripe", color: RJ45.blue },
  { kind: "solid", color: RJ45.orange },
  { kind: "stripe", color: RJ45.brown },
  { kind: "solid", color: RJ45.brown },
];

const T568B_WIRES: Rj45Wire[] = [
  { kind: "stripe", color: RJ45.orange },
  { kind: "solid", color: RJ45.orange },
  { kind: "stripe", color: RJ45.green },
  { kind: "solid", color: RJ45.blue },
  { kind: "stripe", color: RJ45.blue },
  { kind: "solid", color: RJ45.green },
  { kind: "stripe", color: RJ45.brown },
  { kind: "solid", color: RJ45.brown },
];

function Rj45WireBar({
  wire,
  x,
  y,
  width,
  height,
  clipId,
}: {
  wire: Rj45Wire;
  x: number;
  y: number;
  width: number;
  height: number;
  clipId: string;
}) {
  const r = Math.min(width / 2, 3.5);
  if (wire.kind === "solid") {
    return (
      <rect x={x} y={y} width={width} height={height} rx={r} fill={wire.color} />
    );
  }
  // White tip on top (~40%), solid color on bottom (~60%) — matches chart.
  const whiteH = Math.round(height * 0.4);
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={x} y={y} width={width} height={height} fill={wire.color} />
        <rect x={x} y={y} width={width} height={whiteH} fill={RJ45.white} />
      </g>
    </g>
  );
}

function Rj45ConnectorPlug({
  wires,
  idPrefix,
}: {
  wires: Rj45Wire[];
  idPrefix: string;
}) {
  const housingW = 160;
  const housingH = 72;
  const padX = 8;
  const padY = 8;
  const gap = 3.5;
  const barW =
    (housingW - padX * 2 - gap * (wires.length - 1)) / wires.length;
  const barH = housingH - padY * 2;
  const barY = padY;

  return (
    <svg
      viewBox={`0 0 ${housingW} ${housingH}`}
      className="mx-auto h-auto w-full max-w-[11.5rem]"
      role="img"
      aria-hidden="true"
    >
      <rect
        x={0}
        y={0}
        width={housingW}
        height={housingH}
        rx="12"
        fill={RJ45.housing}
      />
      {wires.map((wire, i) => (
        <Rj45WireBar
          key={`${idPrefix}-${i}`}
          wire={wire}
          x={padX + i * (barW + gap)}
          y={barY}
          width={barW}
          height={barH}
          clipId={`${idPrefix}-w${i}`}
        />
      ))}
    </svg>
  );
}

/** Compact T568A / T568B top-view chart — theme-aware chrome, locked wire colors. */
function Rj45WiringStandardsChart() {
  const uid = useId().replace(/:/g, "");
  return (
    <figure
      className="max-w-md space-y-2.5"
      aria-label="RJ45 wiring standards T568A and T568B top view"
    >
      <div>
        <p
          className="text-sm font-extrabold tracking-[0.06em] uppercase sm:text-[15px]"
          style={{ color: RJ45.title }}
        >
          RJ45 Wiring Standards
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-[13px]">
          The two most common RJ45 wiring standards.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1.5">
          <p className="text-center text-xs font-semibold text-[var(--foreground)] sm:text-xs">
            T568A — Top View
          </p>
          <Rj45ConnectorPlug wires={T568A_WIRES} idPrefix={`${uid}-a`} />
        </div>
        <div className="space-y-1.5">
          <p className="text-center text-xs font-semibold text-[var(--foreground)] sm:text-xs">
            T568B — Top View
          </p>
          <Rj45ConnectorPlug wires={T568B_WIRES} idPrefix={`${uid}-b`} />
        </div>
      </div>

      <figcaption className="text-xs text-[var(--muted)]">
        Most AV and commercial installs use{" "}
        <span className="font-semibold text-[var(--foreground)]">T568B</span>
        {" — "}
        terminate both ends the same way for a straight-through cable.
      </figcaption>
    </figure>
  );
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <div key={s + i} className="flex items-center gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center text-xs font-semibold text-[var(--foreground)] shadow-sm">
            {s}
          </div>
          {i < steps.length - 1 ? (
            <span className="text-[var(--brand)]">&rarr;</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Subhead({ children }: { children: string }) {
  return (
    <h4 className="text-lg font-semibold text-[var(--foreground)]">
      {children}
    </h4>
  );
}

function Prose({ children }: { children: string }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it} className="flex gap-2 text-sm text-[var(--muted)]">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

type DefTerm = { term: string; def: string };

function DefGroup({ heading, terms }: { heading: string; terms: DefTerm[] }) {
  return (
    <div>
      <h4 className="mb-3 text-base font-bold tracking-wide text-[var(--brand)] uppercase">
        {heading}
      </h4>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {terms.map((t) => (
          <div key={t.term}>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t.term}
            </p>
            <p className="text-sm text-[var(--muted)]">{t.def}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagrams (inline SVG — themed, dark-mode aware, no external assets)
// ---------------------------------------------------------------------------

const POLAR: Record<string, (deg: number) => number> = {
  Cardioid: (d) => (1 + Math.cos((d * Math.PI) / 180)) / 2,
  Supercardioid: (d) => 0.37 + 0.63 * Math.cos((d * Math.PI) / 180),
  Hypercardioid: (d) => 0.25 + 0.75 * Math.cos((d * Math.PI) / 180),
  "Figure-8": (d) => Math.cos((d * Math.PI) / 180),
  Omnidirectional: () => 1,
};

function polarPath(fn: (d: number) => number, c: number, R: number) {
  const pts: string[] = [];
  for (let a = 0; a <= 360; a += 3) {
    const rad = (a * Math.PI) / 180;
    const r = Math.abs(fn(a));
    pts.push(
      `${(c + r * R * Math.sin(rad)).toFixed(1)},${(
        c -
        r * R * Math.cos(rad)
      ).toFixed(1)}`,
    );
  }
  return "M" + pts.join(" L") + "Z";
}

function PolarPattern({ type }: { type: keyof typeof POLAR }) {
  const size = 148;
  const c = size / 2;
  const R = 54;
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-32 w-32"
      role="img"
      aria-label={`${type} polar pattern`}
    >
      <defs>
        <radialGradient id={`${gid}p`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0.08" />
        </radialGradient>
      </defs>
      {[R, R * 0.66, R * 0.33].map((r) => (
        <circle
          key={r}
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeDasharray="2 3"
        />
      ))}
      <line x1={c} y1={c - R} x2={c} y2={c + R} stroke="var(--border)" />
      <line x1={c - R} y1={c} x2={c + R} y2={c} stroke="var(--border)" />
      <path
        d={polarPath(POLAR[type], c, R)}
        fill={`url(#${gid}p)`}
        stroke="var(--brand)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* capsule indicator */}
      <circle
        cx={c}
        cy={c}
        r="6"
        fill="var(--surface)"
        stroke="var(--brand)"
        strokeWidth="2"
      />
      <circle cx={c} cy={c} r="2.5" fill="var(--brand)" />
      <text x={c} y="12" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--muted)">
        0°
      </text>
      <text x={size - 8} y={c + 3} textAnchor="middle" fontSize="8.5" fill="var(--muted)">
        90
      </text>
      <text x={c} y={size - 4} textAnchor="middle" fontSize="8.5" fill="var(--muted)">
        180
      </text>
      <text x="9" y={c + 3} textAnchor="middle" fontSize="8.5" fill="var(--muted)">
        270
      </text>
    </svg>
  );
}

const POLAR_ITEMS: {
  type: keyof typeof POLAR;
  tag: string;
  lines: string[];
}[] = [
  {
    type: "Cardioid",
    tag: "Unidirectional",
    lines: [
      "Captures the front, rejects the rear. Most common and versatile.",
      "Best for: live vocals & instruments, podcasting, studio recording.",
      "Tip: moving closer increases bass (proximity effect).",
    ],
  },
  {
    type: "Supercardioid",
    tag: "Focused pickup",
    lines: [
      "Tighter front pickup with a small amount of rear sensitivity.",
      "Best for: loud stages, isolating vocals/instruments, drum miking.",
      "Tip: don't cup the mic — it changes the pattern and adds feedback.",
    ],
  },
  {
    type: "Hypercardioid",
    tag: "Highly focused",
    lines: [
      "Strong off-axis rejection with increased rear sensitivity.",
      "Best for: maximum isolation, broadcast, noisy spaces.",
      "Tip: mind monitor placement — rear pickup can cause feedback.",
    ],
  },
  {
    type: "Figure-8",
    tag: "Bi-directional",
    lines: [
      "Captures front and rear equally while rejecting the sides.",
      "Best for: two-person interviews, duets, mid-side (M/S) recording.",
      "Tip: rear pickup captures sound behind the mic (bleed).",
    ],
  },
  {
    type: "Omnidirectional",
    tag: "360° pickup",
    lines: [
      "Captures sound equally from all directions, no null points.",
      "Best for: room/ambient recording, conference mics, lavaliers.",
      "Tip: captures room noise and reflections equally.",
    ],
  },
];

function PolarGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {POLAR_ITEMS.map((it) => (
        <div
          key={it.type}
          className="flex flex-col items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
        >
          <PolarPattern type={it.type} />
          <p className="mt-2 text-sm font-bold tracking-wide text-[var(--foreground)] uppercase">
            {it.type}
          </p>
          <p className="text-xs font-semibold text-[var(--brand)]">{it.tag}</p>
          <div className="mt-2 w-full space-y-1.5">
            {it.lines.map((l) => (
              <p key={l} className="text-sm text-[var(--muted)]">
                {l}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PinFace({ title, count }: { title: string; count: number }) {
  const size = 100;
  const c = size / 2;
  const gid = useId().replace(/:/g, "");
  const ring = count <= 3 ? 21 : 27;
  const pr = count <= 3 ? 9 : 7;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-24 w-24"
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id={`${gid}sh`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f6f9" />
            <stop offset="0.5" stopColor="#c3cad3" />
            <stop offset="1" stopColor="#78808c" />
          </linearGradient>
          <radialGradient id={`${gid}pin`} cx="0.4" cy="0.35" r="0.85">
            <stop offset="0" stopColor="#fef3c7" />
            <stop offset="0.55" stopColor="#f1b02e" />
            <stop offset="1" stopColor="#9a5f0a" />
          </radialGradient>
        </defs>
        {/* metal outer shell */}
        <circle cx={c} cy={c} r={c - 4} fill={`url(#${gid}sh)`} stroke="#586170" strokeWidth="2" />
        {/* dark inner face */}
        <circle cx={c} cy={c} r={c - 15} fill="#1f2733" stroke="#39414f" strokeWidth="2" />
        {/* keyway notch */}
        <rect x={c - 5} y="6" width="10" height="12" rx="2.5" fill={`url(#${gid}sh)`} stroke="#586170" strokeWidth="1" />
        {Array.from({ length: count }).map((_, i) => {
          const a = ((90 - (i * 360) / count) * Math.PI) / 180;
          const x = c + ring * Math.cos(a);
          const y = c - ring * Math.sin(a);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={pr} fill={`url(#${gid}pin)`} stroke="#7c5410" strokeWidth="1" />
              <circle cx={x - pr * 0.3} cy={y - pr * 0.3} r={pr * 0.25} fill="#fffbe8" opacity="0.75" />
              <text
                x={x}
                y={y + 3.2}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#5b3d08"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs font-semibold text-[var(--foreground)]">{title}</p>
    </div>
  );
}

function TrsPlug() {
  const gid = useId().replace(/:/g, "");
  const M = `url(#${gid}m)`;
  const B = `url(#${gid}b)`;
  const SH = `url(#${gid}s)`;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        viewBox="0 0 132 46"
        className="h-16 w-28"
        role="img"
        aria-label="TRS plug"
      >
        <defs>
          <linearGradient id={`${gid}m`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eaeef2" />
            <stop offset="0.5" stopColor="#aab2bd" />
            <stop offset="1" stopColor="#6b7280" />
          </linearGradient>
          <linearGradient id={`${gid}b`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.88" />
            <stop offset="1" stopColor="var(--brand)" />
          </linearGradient>
          <radialGradient id={`${gid}s`} cx="0.34" cy="0.26" r="0.9">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="2" y="14" width="26" height="22" rx="5" fill={B} />
        <rect x="2" y="14" width="26" height="8" rx="5" fill={SH} />
        <rect x="27" y="18" width="56" height="14" rx="3" fill={M} stroke="#586170" strokeWidth="1.5" />
        <rect x="27" y="18" width="56" height="5" rx="3" fill={SH} />
        <rect x="85" y="17" width="4" height="16" rx="1" fill="#1f2733" />
        <rect x="99" y="17" width="4" height="16" rx="1" fill="#1f2733" />
        <path d="M89 17 h20 a8 8 0 0 1 8 8 a8 8 0 0 1 -8 8 h-20 Z" fill={M} stroke="#586170" strokeWidth="1.5" />
        <path d="M89 17 h20 a8 8 0 0 1 8 8 h-28 Z" fill={SH} />
        <text x="112" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--muted)">T</text>
        <text x="93" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--muted)">R</text>
        <text x="55" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--muted)">S</text>
      </svg>
      <p className="text-xs font-semibold text-[var(--foreground)]">
        TRS (Tip · Ring · Sleeve)
      </p>
    </div>
  );
}

// Detailed connector illustrations (our own SVG art, brand-palette + metals).
function ConnectorGlyph({
  title,
  className = "h-16 w-auto",
}: {
  title: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const M = `url(#${id}m)`;
  const MH = `url(#${id}mh)`;
  const G = `url(#${id}g)`;
  const B = `url(#${id}b)`;
  const SH = `url(#${id}s)`;
  const DARK = "#1f2733";
  const EDGE = "#586170";
  const t = title.toLowerCase();

  const Defs = (
    <defs>
      <linearGradient id={`${id}m`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f8fafc" />
        <stop offset="0.45" stopColor="#cdd3db" />
        <stop offset="0.55" stopColor="#aab2bd" />
        <stop offset="1" stopColor="#6f7883" />
      </linearGradient>
      <linearGradient id={`${id}mh`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#eaeef2" />
        <stop offset="0.5" stopColor="#aab2bd" />
        <stop offset="1" stopColor="#6b7280" />
      </linearGradient>
      <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fef3c7" />
        <stop offset="0.5" stopColor="#f1b02e" />
        <stop offset="1" stopColor="#a16207" />
      </linearGradient>
      <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--brand)" stopOpacity="0.88" />
        <stop offset="1" stopColor="var(--brand)" />
      </linearGradient>
      <radialGradient id={`${id}s`} cx="0.34" cy="0.26" r="0.9">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );

  // XLR / DMX — round face with pins
  if (t.includes("xlr") || t.includes("dmx")) {
    const pins = t.includes("5-pin") ? 5 : 3;
    return (
      <svg viewBox="0 0 96 96" className={className} role="img" aria-label={title}>
        {Defs}
        <circle cx="48" cy="48" r="43" fill={M} stroke={EDGE} strokeWidth="2" />
        <circle cx="48" cy="48" r="43" fill={SH} />
        <circle cx="48" cy="48" r="34" fill={DARK} stroke="#39414f" strokeWidth="2" />
        <rect x="43" y="8" width="10" height="12" rx="2.5" fill={M} stroke={EDGE} strokeWidth="1.5" />
        {Array.from({ length: pins }).map((_, i) => {
          const a = ((90 - (i * 360) / pins) * Math.PI) / 180;
          const cx = 48 + 17 * Math.cos(a);
          const cy = 48 - 17 * Math.sin(a);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="6.2" fill={G} stroke="#7c5410" strokeWidth="1" />
              <circle cx={cx - 1.6} cy={cy - 1.8} r="1.7" fill="#fffbe8" opacity="0.8" />
            </g>
          );
        })}
      </svg>
    );
  }

  // 1/4" TS / TRS — phone plug (side)
  if (t.includes("ts/trs") || t.includes("trs") || t.includes("1/4")) {
    return (
      <svg viewBox="0 0 128 48" className={className} role="img" aria-label={title}>
        {Defs}
        <rect x="2" y="12" width="26" height="24" rx="5" fill={B} />
        <rect x="2" y="12" width="26" height="9" rx="5" fill={SH} />
        <rect x="27" y="16" width="55" height="16" rx="3" fill={MH} stroke={EDGE} strokeWidth="1.5" />
        <rect x="27" y="16" width="55" height="6" rx="3" fill={SH} />
        <rect x="84" y="15" width="5" height="18" rx="1" fill={DARK} />
        <rect x="98" y="15" width="4" height="18" rx="1" fill={DARK} />
        <path d="M89 15 h20 a9 9 0 0 1 9 9 a9 9 0 0 1 -9 9 h-20 Z" fill={MH} stroke={EDGE} strokeWidth="1.5" />
        <path d="M89 15 h20 a9 9 0 0 1 9 9 h-29 Z" fill={SH} />
      </svg>
    );
  }

  // powerCON TRUE1 — sealed latching AC connector (black/yellow, top latch)
  if (t.includes("true1") || t.includes("true 1") || t.includes("truecon")) {
    return (
      <svg viewBox="0 0 104 84" className={className} role="img" aria-label={title}>
        {Defs}
        <defs>
          <linearGradient id={`${id}blk3`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3f47" />
            <stop offset="0.5" stopColor="#23272e" />
            <stop offset="1" stopColor="#0f1216" />
          </linearGradient>
        </defs>
        {/* thumb-latch lever on top */}
        <rect x="38" y="4" width="28" height="16" rx="4" fill="#2a2f36" stroke="#0b0d10" strokeWidth="1.5" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={43 + i * 6} y="8" width="3" height="8" rx="1.5" fill="#565c64" />
        ))}
        {/* main housing */}
        <rect x="10" y="18" width="84" height="54" rx="15" fill={`url(#${id}blk3)`} stroke="#0b0d10" strokeWidth="2" />
        <rect x="10" y="18" width="84" height="17" rx="15" fill={SH} />
        {/* yellow accent (black/yellow variant) */}
        <rect x="14" y="62" width="76" height="6" rx="3" fill="#e6b000" opacity="0.9" />
        {/* recessed contact face */}
        <circle cx="52" cy="45" r="21" fill="#15181d" stroke="#000" strokeWidth="1.5" />
        <rect x="48" y="26" width="8" height="9" rx="2" fill="#0b0d10" />
        <circle cx="52" cy="45" r="5.5" fill="#3a3f47" stroke="#0b0d10" strokeWidth="1.2" />
        {[90, 210, 330].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const cx = 52 + 12 * Math.cos(a);
          const cy = 45 + 12 * Math.sin(a);
          return (
            <circle key={deg} cx={cx} cy={cy} r="4" fill={MH} stroke="#3a4048" strokeWidth="0.8" />
          );
        })}
      </svg>
    );
  }

  // powerCON — round AC twist-lock, blue = input (3 contacts + key)
  if (t.includes("powercon")) {
    return (
      <svg viewBox="0 0 96 96" className={className} role="img" aria-label={title}>
        {Defs}
        <defs>
          <linearGradient id={`${id}blu`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4a86d6" />
            <stop offset="0.5" stopColor="#1f5fae" />
            <stop offset="1" stopColor="#123f7a" />
          </linearGradient>
          <radialGradient id={`${id}blk2`} cx="0.4" cy="0.34" r="0.85">
            <stop offset="0" stopColor="#2b3038" />
            <stop offset="1" stopColor="#101318" />
          </radialGradient>
        </defs>
        <circle cx="48" cy="48" r="44" fill={`url(#${id}blk2)`} stroke="#0b0d10" strokeWidth="2" />
        <circle cx="48" cy="48" r="40" fill={`url(#${id}blu)`} stroke="#0e356b" strokeWidth="1.5" />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={48 + 34 * Math.cos(a)}
              y1={48 + 34 * Math.sin(a)}
              x2={48 + 40 * Math.cos(a)}
              y2={48 + 40 * Math.sin(a)}
              stroke="#0e356b"
              strokeOpacity="0.6"
              strokeWidth="1.3"
            />
          );
        })}
        <circle cx="48" cy="48" r="44" fill={SH} />
        <circle cx="48" cy="48" r="27" fill="#15181d" stroke="#000" strokeWidth="1.5" />
        <rect x="44" y="16" width="8" height="10" rx="2" fill="#0e356b" />
        <circle cx="48" cy="48" r="7" fill="#3a3f47" stroke="#0b0d10" strokeWidth="1.4" />
        {[90, 210, 330].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const cx = 48 + 16 * Math.cos(a);
          const cy = 48 + 16 * Math.sin(a);
          return (
            <circle key={deg} cx={cx} cy={cy} r="5" fill={MH} stroke="#3a4048" strokeWidth="0.8" />
          );
        })}
      </svg>
    );
  }

  // speakON — black round twist-lock, centre key + 4 blade contacts
  if (t.includes("speakon")) {
    return (
      <svg viewBox="0 0 96 96" className={className} role="img" aria-label={title}>
        {Defs}
        <defs>
          <radialGradient id={`${id}blk`} cx="0.4" cy="0.34" r="0.85">
            <stop offset="0" stopColor="#3b4048" />
            <stop offset="0.6" stopColor="#22262d" />
            <stop offset="1" stopColor="#0f1216" />
          </radialGradient>
        </defs>
        {/* latch tab */}
        <rect x="40" y="2" width="16" height="10" rx="2.5" fill="#2a2f36" stroke="#0b0d10" strokeWidth="1" />
        <rect x="43" y="4" width="10" height="2.4" rx="1" fill="#565c64" />
        {/* housing */}
        <circle cx="48" cy="48" r="44" fill={`url(#${id}blk)`} stroke="#0b0d10" strokeWidth="2" />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={48 + 38 * Math.cos(a)}
              y1={48 + 38 * Math.sin(a)}
              x2={48 + 43 * Math.cos(a)}
              y2={48 + 43 * Math.sin(a)}
              stroke="#000000"
              strokeOpacity="0.45"
              strokeWidth="1.4"
            />
          );
        })}
        <circle cx="48" cy="48" r="44" fill={SH} />
        <circle cx="48" cy="48" r="30" fill="#15181d" stroke="#000" strokeWidth="1.5" />
        <rect x="44" y="14" width="8" height="10" rx="2" fill="#0b0d10" />
        <circle cx="48" cy="48" r="8" fill="#3a3f47" stroke="#0b0d10" strokeWidth="1.5" />
        {[45, 135, 225, 315].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const cx = 48 + 18 * Math.cos(a);
          const cy = 48 + 18 * Math.sin(a);
          return (
            <g key={deg} transform={`rotate(${deg + 90} ${cx} ${cy})`}>
              <rect x={cx - 3.4} y={cy - 6} width="6.8" height="12" rx="2" fill={MH} stroke="#3a4048" strokeWidth="0.8" />
            </g>
          );
        })}
      </svg>
    );
  }

  // RCA — cylindrical with center pin
  if (t.includes("rca")) {
    return (
      <svg viewBox="0 0 128 48" className={className} role="img" aria-label={title}>
        {Defs}
        <rect x="2" y="10" width="28" height="28" rx="6" fill={B} />
        <rect x="2" y="10" width="28" height="10" rx="6" fill={SH} />
        <rect x="30" y="13" width="56" height="22" rx="9" fill={MH} stroke={EDGE} strokeWidth="1.5" />
        <rect x="30" y="13" width="56" height="8" rx="9" fill={SH} />
        <rect x="46" y="12" width="3" height="24" fill={DARK} opacity="0.5" />
        <rect x="62" y="12" width="3" height="24" fill={DARK} opacity="0.5" />
        <rect x="86" y="15" width="7" height="18" rx="2" fill={DARK} />
        <rect x="93" y="20" width="33" height="8" rx="4" fill={MH} stroke={EDGE} strokeWidth="1" />
      </svg>
    );
  }

  // HDMI — trapezoid plug with gold contacts
  if (t.includes("hdmi")) {
    return (
      <svg viewBox="0 0 128 64" className={className} role="img" aria-label={title}>
        {Defs}
        <path d="M14 12 h100 l-9 30 h-82 Z" fill={M} stroke={EDGE} strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 12 h100 l-4 13 h-92 Z" fill={SH} />
        <path d="M24 18 h80 l-5 17 h-70 Z" fill={DARK} />
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={i} x={28 + i * 5.4} y="21" width="2.6" height="9" rx="1" fill={G} />
        ))}
        <rect x="50" y="44" width="28" height="16" rx="4" fill={B} />
        <rect x="50" y="44" width="28" height="6" rx="4" fill={SH} />
      </svg>
    );
  }

  // BNC — bayonet with center pin
  if (t.includes("bnc")) {
    return (
      <svg viewBox="0 0 96 96" className={className} role="img" aria-label={title}>
        {Defs}
        <circle cx="48" cy="48" r="43" fill={M} stroke={EDGE} strokeWidth="2" />
        <circle cx="48" cy="48" r="43" fill={SH} />
        <circle cx="48" cy="48" r="34" fill="none" stroke="#4b5563" strokeWidth="3" />
        <rect x="4" y="42" width="8" height="12" rx="2" fill={MH} stroke="#4b5563" strokeWidth="1" />
        <rect x="84" y="42" width="8" height="12" rx="2" fill={MH} stroke="#4b5563" strokeWidth="1" />
        <circle cx="48" cy="48" r="22" fill={DARK} />
        <circle cx="48" cy="48" r="6" fill={M} stroke="#4b5563" strokeWidth="1" />
      </svg>
    );
  }

  // RJ45 / Ethernet — modular plug with gold pins
  if (t.includes("rj45") || t.includes("ethernet")) {
    return (
      <svg viewBox="0 0 112 88" className={className} role="img" aria-label={title}>
        {Defs}
        <path
          d="M20 14 h72 v42 h-20 v10 h-32 v-10 h-20 Z"
          fill="var(--brand)"
          fillOpacity="0.22"
          stroke="var(--brand)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M20 14 h72 v10 h-72 Z" fill="#ffffff" fillOpacity="0.35" />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={26 + i * 7.6} y="18" width="3.4" height="20" rx="1" fill={G} />
        ))}
        <rect x="46" y="66" width="20" height="16" rx="3" fill="var(--brand)" />
      </svg>
    );
  }

  // USB-C — symmetric rounded (pill) shell with centre tongue
  if (t.includes("usb-c")) {
    return (
      <svg viewBox="0 0 128 48" className={className} role="img" aria-label={title}>
        {Defs}
        <rect x="92" y="12" width="32" height="24" rx="7" fill={B} />
        <rect x="92" y="12" width="32" height="9" rx="7" fill={SH} />
        <rect x="6" y="12" width="92" height="24" rx="12" fill={M} stroke={EDGE} strokeWidth="2" />
        <rect x="6" y="12" width="92" height="9" rx="12" fill={SH} />
        <rect x="12" y="17" width="72" height="14" rx="7" fill={DARK} />
        <rect x="17" y="21" width="62" height="6" rx="3" fill="#9aa3ad" />
      </svg>
    );
  }

  // USB-A (flat rectangular) and USB-B (bevelled square printer plug)
  if (t.includes("usb")) {
    return (
      <svg viewBox="0 0 128 72" className={className} role="img" aria-label={title}>
        {Defs}
        {/* USB-A (left) */}
        <rect x="2" y="20" width="14" height="20" rx="3" fill={B} />
        <rect x="16" y="16" width="42" height="28" rx="2" fill={M} stroke={EDGE} strokeWidth="2" />
        <rect x="16" y="16" width="42" height="9" rx="2" fill={SH} />
        <rect x="24" y="19" width="6" height="4" rx="1" fill="#6b7280" />
        <rect x="43" y="19" width="6" height="4" rx="1" fill="#6b7280" />
        <rect x="49" y="21" width="11" height="18" rx="1.5" fill="#e9edf1" stroke="#9aa3ad" strokeWidth="1" />
        {Array.from({ length: 4 }).map((_, i) => (
          <rect key={i} x="51" y={23.5 + i * 3.6} width="7" height="2.2" rx="1" fill={G} />
        ))}
        <text x="37" y="60" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--muted)">
          USB-A
        </text>
        {/* USB-B (right) */}
        <rect x="94" y="4" width="13" height="16" rx="3" fill={B} />
        <path d="M88 18 h24 l8 8 v18 h-40 v-18 Z" fill={M} stroke={EDGE} strokeWidth="2" strokeLinejoin="round" />
        <path d="M88 18 h24 l8 8 h-40 Z" fill={SH} />
        <rect x="86" y="28" width="28" height="14" rx="2" fill={DARK} />
        <rect x="90" y="31" width="20" height="4" rx="1" fill="#9aa3ad" />
        <text x="100" y="60" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--muted)">
          USB-B
        </text>
      </svg>
    );
  }

  // IEC — power inlet with 3 pins
  if (t.includes("iec")) {
    return (
      <svg viewBox="0 0 120 72" className={className} role="img" aria-label={title}>
        {Defs}
        <path
          d="M12 12 h96 v34 a12 12 0 0 1 -12 12 h-72 a12 12 0 0 1 -12 -12 Z"
          fill="#2b3140"
          stroke="#4b5563"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 12 h96 v9 h-96 Z" fill="#ffffff" fillOpacity="0.12" />
        {[34, 60, 86].map((x) => (
          <g key={x}>
            <rect x={x - 6} y="24" width="12" height="24" rx="3" fill="#0d1017" />
            <rect x={x - 2} y="28" width="4" height="16" rx="1.5" fill={MH} />
          </g>
        ))}
      </svg>
    );
  }

  // Euroblock / Phoenix — terminal block with screws
  if (t.includes("euroblock") || t.includes("phoenix")) {
    return (
      <svg viewBox="0 0 128 56" className={className} role="img" aria-label={title}>
        {Defs}
        <rect x="6" y="8" width="116" height="40" rx="3" fill={B} />
        <rect x="6" y="8" width="116" height="12" rx="3" fill={SH} />
        {[22, 44, 66, 88, 110].map((x) => (
          <g key={x}>
            <circle cx={x} cy="20" r="6.5" fill={MH} stroke="#4b5563" strokeWidth="1" />
            <rect x={x - 5} y="19" width="10" height="2" rx="1" fill="#3a4150" />
            <rect x={x - 4} y="34" width="8" height="8" rx="1.5" fill={DARK} />
          </g>
        ))}
      </svg>
    );
  }

  // Fallback — generic barrel plug
  return (
    <svg viewBox="0 0 128 44" className={className} role="img" aria-label={title}>
      {Defs}
      <rect x="4" y="12" width="26" height="20" rx="5" fill={B} />
      <rect x="30" y="15" width="60" height="14" rx="4" fill={MH} stroke={EDGE} strokeWidth="1.5" />
      <rect x="30" y="15" width="60" height="5" rx="4" fill={SH} />
      <rect x="90" y="18" width="34" height="8" rx="4" fill={MH} stroke={EDGE} strokeWidth="1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Accordion shell
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--surface-hover)] sm:px-5"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[var(--foreground)]">
            {title}
          </span>
          <span className="block text-sm text-[var(--muted)]">{subtitle}</span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[var(--muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="space-y-6 border-t border-[var(--border)] px-4 py-6 sm:px-6">
          {children}
        </div>
      ) : null}
    </section>
  );
}

// ===========================================================================
// Guide
// ===========================================================================

export function AvResourceGuide() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    connections: true,
  });
  const toggle = (id: string) =>
    setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className={["space-y-4", AV_GUIDE_BRAND_VARS].join(" ")}>
      {/* 1. Connections & Signal Types ------------------------------------ */}
      <Section
        icon={Cable}
        title="Connections & Signal Types"
        subtitle="Connectors, pinouts, signal types, and how to choose them."
        open={!!open.connections}
        onToggle={() => toggle("connections")}
      >
        <Banner
          title="Cable Connector Guide, part 1"
          subtitle="Connectors & Use Cases: Identify common AV connectors, understand where they're used, and how they connect."
        />
        <CardRow
          cards={[
            { title: "3-Pin XLR", lines: ["For balanced mic/line level signals"] },
            {
              title: '1/4" TS/TRS',
              lines: [
                "TS: for unbalanced/inst signals",
                "TRS: for balanced line level signals",
              ],
            },
            {
              title: "speakON",
              lines: ["For speaker-level connections from amplifier to speaker"],
            },
            {
              title: "Euroblock (Phoenix)",
              lines: ["For fixed-install speakers and control connections"],
            },
            {
              title: "RCA (Phono)",
              lines: ["For unbalanced audio and SD video signals"],
            },
            {
              title: "3-Pin DMX",
              lines: ["For DMX control in fixtures with a 3-pin connector"],
            },
            {
              title: "5-Pin DMX",
              lines: ["For DMX control in fixtures with a 5-pin connector"],
            },
            {
              title: "HDMI",
              lines: ["For HD digital video and digital audio signals"],
            },
            {
              title: "BNC",
              lines: [
                "75Ω: for professional SDI video signals",
                "50Ω: for wireless system antenna connections",
              ],
            },
            {
              title: "RJ45 (Ethernet)",
              lines: ["For networking and AVoIP signals"],
            },
            {
              title: "USB-A / USB-B",
              lines: ["For connecting computers and peripherals"],
            },
            {
              title: "USB-C",
              lines: [
                "For high-speed data, video, or power delivery. Check cable specs before use.",
              ],
            },
            {
              title: "powerCON",
              lines: ["For AC mains power to audio, video, and lighting devices"],
            },
            {
              title: "powerCON TRUE1",
              lines: ["For AC mains power with IP-rated protection when mated"],
            },
            { title: "IEC", lines: ["For AC power connections to equipment"] },
          ]}
        />
        <div>
          <Eyebrow>Common Connection Endpoints</Eyebrow>
          <div className="mt-3">
            <Pillars
              items={[
                {
                  title: "Wall Plates",
                  lines: [
                    "Provide clean, accessible AV connections in standard wall-mounted enclosures.",
                  ],
                },
                {
                  title: "Floor Boxes",
                  lines: [
                    "Recessed enclosures that keep connections organized and hidden while not in use.",
                  ],
                },
                {
                  title: "Stageboxes",
                  lines: [
                    "Connect stage inputs and outputs to a front-of-house mixer through a single cable run.",
                  ],
                },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Subhead>Pinouts</Subhead>
          <Prose>
            How common connectors are wired. XLR is pin-2 hot; DMX is pin-3 hot.
          </Prose>
          <div className="flex flex-wrap items-end justify-center gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-5 sm:justify-start">
            <PinFace title="3-Pin XLR" count={3} />
            <PinFace title="3-Pin DMX" count={3} />
            <PinFace title="5-Pin DMX" count={5} />
            <PinFace title="speakON (4-pole)" count={4} />
            <TrsPlug />
          </div>
          <Pillars
            cols={4}
            items={[
              {
                title: "XLR",
                tag: "Pin 2 hot",
                lines: [
                  "Pin 1: Ground",
                  "Pin 2: Positive (+)",
                  "Pin 3: Negative (−)",
                ],
              },
              {
                title: "DMX",
                tag: "Pin 3 hot",
                lines: [
                  "Pin 1: Ground",
                  "Pin 2: Data (−)",
                  "Pin 3: Data (+)",
                  "5-pin adds Pin 4/5: Aux (−/+)",
                ],
              },
              {
                title: "speakON",
                lines: [
                  "1+ / 1−: Channel A",
                  "2+ / 2−: Channel B (4-pole)",
                ],
              },
              {
                title: "TRS / TS",
                lines: [
                  "TRS — Tip: +, Ring: −, Sleeve: ground",
                  "TS — Tip: +, Sleeve: −/ground",
                ],
              },
            ]}
          />
        </div>

        <div className="space-y-3">
          <Subhead>Signal Types</Subhead>
          <Prose>
            The difference between balanced, unbalanced, and digital signals, and
            where you will run into each one.
          </Prose>
          <Pillars
            items={[
              {
                title: "Balanced Signal",
                lines: [
                  "What it is: Uses positive (+), negative (−), and ground conductors to carry signal.",
                  "Why it matters: Reduces noise and interference, especially over long runs.",
                  "Where you'll see it: XLR and TRS in live sound, installs, and studio systems.",
                ],
              },
              {
                title: "Unbalanced Signal",
                lines: [
                  "What it is: Uses a single positive (+) signal path with a ground.",
                  "Why it matters: More susceptible to noise, especially over distance.",
                  "Where you'll see it: RCA, TS, and stereo L/R TRS in consumer and instrument cables.",
                ],
              },
              {
                title: "Digital Signals",
                lines: [
                  "What it is: Transmits audio or video as data rather than signal voltage.",
                  "Why it matters: Maintains quality over distance and enables high-res formats.",
                  "Where you'll see it: HDMI, SDI, USB, and networks like Dante and AVoIP.",
                ],
              },
            ]}
          />
          <Table
            head={["", "Analog (Balanced/Unbalanced)", "Digital"]}
            rows={[
              ["Signal", "Continuous electrical signal", "Data-based transmission"],
              [
                "Distance",
                "Can degrade over long distances",
                "Maintains integrity over distance",
              ],
              [
                "Formats",
                "Simple and widely compatible",
                "Enables high-bandwidth formats",
              ],
            ]}
          />
        </div>

        <Banner
          title="Cable Connector Guide, part 2"
          subtitle="Cable Performance & Distance: understand how far signals can travel and which cable types support your system."
        />
        <div>
          <Eyebrow>Analog & Control Signal Distance Guidelines</Eyebrow>
          <div className="mt-3">
            <Pillars
              items={[
                {
                  title: "Balanced — XLR / TRS",
                  tag: "Long-run reliable",
                  lines: [
                    "Up to 300 ft. (90m)",
                    "Resists noise and interference",
                    "Ideal for long cable runs",
                  ],
                },
                {
                  title: "Unbalanced — RCA / TS",
                  tag: "Short run only",
                  lines: [
                    "Up to 20–25 ft. (6–8m)",
                    "More susceptible to noise",
                    "Best for short connections",
                  ],
                },
                {
                  title: "DMX — Lighting Control",
                  tag: "Daisy-chain ready",
                  lines: [
                    "Up to 1,000 ft. (300m)",
                    "Supports daisy-chaining fixtures",
                    "Requires proper termination",
                  ],
                },
              ]}
            />
          </div>
        </div>
        <div className="space-y-3">
          <Subhead>HDMI Performance & Distance</Subhead>
          <Table
            head={["Type", "Distance", "Best Use Case"]}
            rows={[
              ["Passive HDMI", "Up to 33 ft. (10m)", "Short device connections"],
              ["Active HDMI", "Up to 66 ft. (20m)", "Medium-length runs"],
              ["Active Optical", "Up to 330 ft. (100m)", "Long-distance AV"],
            ]}
          />
          <Tip body="Higher-resolution signals such as 4K at 60Hz require shorter cable runs; lower resolutions travel farther. If your HDMI run exceeds 25–30 ft., use active or fiber HDMI, or an active HDMI extender, to maintain signal quality." />
        </div>
        <div className="space-y-3">
          <Subhead>Category (Ethernet) Cable Performance & Distance</Subhead>
          <Table
            head={["Type", "Speed", "Distance", "Best Use Case"]}
            rows={[
              ["CAT5e", "1 Gbps", "Up to 330 ft. (100m)", "Basic networks, short runs"],
              ["CAT6", "1–10 Gbps", "Up to 330 ft. (100m)", "Most AV installations"],
              ["CAT6A", "10 Gbps", "Up to 330 ft. (100m)", "High-bandwidth systems"],
            ]}
          />
          <Prose>
            Where CAT cable is used: audio networking such as Dante, AV-over-IP
            systems, and control systems and infrastructure.
          </Prose>
        </div>

        <div className="space-y-3">
          <Subhead>Installation & System Decisions</Subhead>
          <Prose>
            Apply your knowledge and make confident decisions about your
            system&rsquo;s connection needs.
          </Prose>
          <Pillars
            cols={2}
            items={[
              {
                title: "Audio",
                lines: [
                  "Use XLR for balanced audio and long cable runs",
                  "Use TRS for balanced or stereo line-level connections",
                ],
              },
              {
                title: "Video",
                lines: [
                  "Use HDMI for short device-to-display connections",
                  "Use SDI for longer runs in production environments",
                ],
              },
              {
                title: "Speakers",
                lines: ["Use speakON for amplifier-to-speaker connections"],
              },
              {
                title: "Power",
                lines: ["Use powerCON or TRUE1 for secure power connections"],
              },
              {
                title: "Network / AV Systems",
                lines: ["Use CAT6 for AV-over-IP, Dante, and installed systems"],
              },
            ]}
          />
          <Rj45WiringStandardsChart />
          <Subhead>Choosing the Right Video Signal Path</Subhead>
          <Table
            head={["Type", "Typical Distance", "Key Advantage", "Best Use Case"]}
            rows={[
              ["HDMI", "Up to 33 ft.", "Simple, plug & play", "Direct device-to-display"],
              ["SDI", "50–300 ft.", "Reliable, locking signal", "Live productions & broadcast"],
              ["CAT6", "Up to 330 ft.", "Flexible, scalable", "Installed & networked AV"],
            ]}
          />
          <Subhead>Cable Termination Reference</Subhead>
          <Table
            head={["Cable Type", "Connector", "Termination Method"]}
            rows={[
              ["Microphone cable", "XLR", "Solder"],
              ["Line / instrument cable", "TRS / TS", "Solder"],
              ["CAT6 (Ethernet) cable", "RJ45", "Crimp"],
              ["SDI coax", "BNC", "Compression or crimp"],
              ["Speaker cable", "speakON", "Screw terminal or solder"],
              ["Install cable", "Euroblock", "Screw terminal"],
            ]}
          />
        </div>
      </Section>

      {/* 2. IP Ratings ---------------------------------------------------- */}
      <Section
        icon={Droplets}
        title="IP Ratings & Environmental Protection"
        subtitle="How to match gear to dust and water exposure."
        open={!!open.ip}
        onToggle={() => toggle("ip")}
      >
        <Banner
          title="IP Ratings Explained"
          subtitle="Understanding Dust & Water Protection — match your equipment to the real-world conditions it will face."
        />
        <Prose>
          When gear is exposed to dust, rain, or unpredictable environments,
          durability becomes critical. An Ingress Protection (IP) rating defines
          how well a device is sealed against dust and water — helping you
          choose equipment that performs reliably in the real world.
        </Prose>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-24 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--brand)] text-white">
              <span className="text-2xl font-extrabold tracking-tight">IP65</span>
              <span className="text-xs tracking-[0.18em] uppercase opacity-80">
                Rating
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <Wind className="h-5 w-5 text-[var(--brand)]" />
                <div>
                  <p className="text-lg leading-none font-bold text-[var(--foreground)]">
                    6
                  </p>
                  <p className="mt-1 text-xs tracking-wide text-[var(--muted)] uppercase">
                    1st digit &middot; dust (0&ndash;6)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <Droplets className="h-5 w-5 text-[var(--brand)]" />
                <div>
                  <p className="text-lg leading-none font-bold text-[var(--foreground)]">
                    5
                  </p>
                  <p className="mt-1 text-xs tracking-wide text-[var(--muted)] uppercase">
                    2nd digit &middot; water (0&ndash;9)
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Note: If an &quot;X&quot; appears in an IP rating, the device was not
            tested for that element.
          </p>
        </div>
        <Tip
          title="IP Rating Quick Reference"
          body="IP20 — basic indoor. IP44 — limited dust + splash. IP65 — dust-tight + water jets. IP67 — dust-tight + temporary submersion. IP68 — dust-tight + continuous submersion."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Subhead>Dust / Solid Object Protection</Subhead>
            <Table
              head={["Rating", "Description"]}
              rows={[
                ["IP0X", "No protection"],
                ["IP1X", "Objects > 50mm"],
                ["IP2X", "Objects > 12.5mm"],
                ["IP3X", "Objects > 2.5mm"],
                ["IP4X", "Objects > 1mm"],
                ["IP5X", "Limited dust ingress"],
                ["IP6X", "Totally dust-tight"],
              ]}
            />
          </div>
          <div className="space-y-2">
            <Subhead>Water Ingress Protection</Subhead>
            <Table
              head={["Rating", "Description"]}
              rows={[
                ["IPX0", "No protection"],
                ["IPX1", "Dripping water (vertical)"],
                ["IPX2", "Dripping water at 15°"],
                ["IPX3", "Spraying water up to 60°"],
                ["IPX4", "Splashing water, any direction"],
                ["IPX5", "Water jets (low pressure)"],
                ["IPX6", "Powerful water jets"],
                ["IPX7", "Immersion up to 1m depth"],
                ["IPX8", "Continuous submersion"],
                ["IPX9", "High-pressure, high-temp jets"],
              ]}
            />
          </div>
        </div>
        <div className="space-y-3">
          <Subhead>Choosing the Right IP Rating</Subhead>
          <Pillars
            cols={4}
            items={[
              {
                title: "Indoor",
                tag: "Typical: IP20 – IP40",
                lines: [
                  "Classrooms, studios, houses of worship. Controlled spaces with minimal dust or moisture.",
                ],
              },
              {
                title: "Live Production & Touring",
                tag: "Typical: IP44 – IP54",
                lines: [
                  "Stages, mobile rigs, temporary outdoor setups. Handles dust, quick spills, changing conditions.",
                ],
              },
              {
                title: "Outdoor Installs",
                tag: "Typical: IP65+",
                lines: [
                  "Permanent lighting, architectural AV, venues. Built to withstand rain, dust, and exposure.",
                ],
              },
              {
                title: "Harsh Environments",
                tag: "Typical: IP67+",
                lines: [
                  "Festivals, industrial, marine. Built for heavy rain, washdowns, and extreme conditions.",
                ],
              },
            ]}
          />
          <Tip body="IP ratings measure protection against dust and water — but not impact, UV exposure, or extreme temperatures. For outdoor or touring setups, make sure your gear is rated for the full environment, not just ingress." />
        </div>
      </Section>

      {/* 3. Microphones --------------------------------------------------- */}
      <Section
        icon={Mic}
        title="Microphones & Polar Patterns"
        subtitle="Pickup patterns and choosing the right mic for the job."
        open={!!open.mics}
        onToggle={() => toggle("mics")}
      >
        <Banner
          title="Microphone Polar Patterns"
          subtitle="How microphones pick up sound — and how to choose the right pattern for the job."
        />
        <Prose>
          A polar pattern describes how a mic captures sound from different
          directions — helping you control what gets heard and what gets
          rejected. The circular graph shows sensitivity at every angle: front
          (0°) at the top, sides at 90°/270°, rear at 180°.
        </Prose>
        <PolarGrid />
        <div className="space-y-3">
          <Subhead>Choosing the Right Pattern for the Job</Subhead>
          <Pillars
            items={[
              {
                title: "Live Performance (Stage)",
                tag: "Cardioid / Supercardioid",
                lines: [
                  "Reduces monitor bleed and feedback. Supercardioid tightens isolation further on loud stages.",
                ],
              },
              {
                title: "Broadcast / Podcasting",
                tag: "Cardioid / Hypercardioid",
                lines: [
                  "Focused voice capture with minimal room noise — keeps recordings sounding professional.",
                ],
              },
              {
                title: "Interviews / Two-Person",
                tag: "Figure-8",
                lines: [
                  "One mic between two speakers captures both evenly with natural side rejection.",
                ],
              },
              {
                title: "Room / Ambient",
                tag: "Omnidirectional",
                lines: [
                  "Natural full-space capture. No proximity effect, no off-axis coloration.",
                ],
              },
              {
                title: "High-Noise Environments",
                tag: "Hypercardioid",
                lines: [
                  "Tightest pickup angle of any standard pattern — maximum rejection of surrounding noise.",
                ],
              },
            ]}
          />
          <Subhead>Common Microphones by Polar Pattern</Subhead>
          <Table
            head={["Mic Type", "Typical Pattern", "Typical Use"]}
            rows={[
              ["Handheld", "Cardioid", "Live vocals, presentations"],
              ["Shotgun", "Hypercardioid", "Film, broadcast, focused capture"],
              ["Lavalier", "Omnidirectional", "Body-worn for presenters & talent"],
              ["Ribbon", "Figure-8", "Studio vocals, instruments, M/S"],
            ]}
          />
        </div>
      </Section>

      {/* 4. Signal Flow --------------------------------------------------- */}
      <Section
        icon={Workflow}
        title="Signal Flow Fundamentals"
        subtitle="How audio travels from source to output, stage by stage."
        open={!!open.signal}
        onToggle={() => toggle("signal")}
      >
        <Banner
          title="Signal Flow Fundamentals"
          subtitle="Source, processing, distribution, output — the foundation to design, operate, and troubleshoot any pro AV system."
        />
        <Flow steps={["01 Source", "02 Processing", "03 Distribution", "04 Output"]} />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Subhead>What is signal flow?</Subhead>
            <Prose>
              Signal flow describes the path audio or video takes as it moves
              through a system — from the original source to final output.
              Every AV system, regardless of size, follows: Source &rsaquo;
              Processing &rsaquo; Distribution &rsaquo; Output.
            </Prose>
          </div>
          <div className="space-y-2">
            <Subhead>Why it matters</Subhead>
            <Bullets
              items={[
                "Diagnose audio or video issues quickly",
                "Design systems that scale effectively",
                "Prevent signal loss or routing errors",
                "Optimize system performance",
              ]}
            />
          </div>
        </div>
        <Subhead>From Source to Output</Subhead>
        <Pillars
          cols={4}
          items={[
            {
              title: "01 Source",
              tag: "Where the signal begins",
              lines: [
                "Captures or generates the AV signal and defines the quality of everything downstream.",
                "Mics, cameras, playback devices, wireless receivers.",
              ],
            },
            {
              title: "02 Processing",
              tag: "Shaping the signal",
              lines: [
                "Adjust tone, balance levels, and prepare the signal for distribution.",
                "Mixers, EQ & dynamics, video switchers, DSP.",
              ],
            },
            {
              title: "03 Distribution",
              tag: "Routing to destinations",
              lines: [
                "Route signals across a room, a building, or a network.",
                "Dante audio networks, matrix routing, patch bays, AV-over-IP.",
              ],
            },
            {
              title: "04 Output",
              tag: "Delivering the signal",
              lines: [
                "Deliver to output devices where the audience hears or sees the result.",
                "Speakers & monitors, streaming feeds, recorders, displays.",
              ],
            },
          ]}
        />
        <Tip
          title="Pro Tip — Troubleshooting"
          body="When diagnosing system issues, follow the signal path step by step — from source to output. This methodical approach isolates problems quickly and prevents unnecessary adjustments elsewhere in the system."
        />
      </Section>

      {/* 5. Wireless ------------------------------------------------------ */}
      <Section
        icon={Radio}
        title="Wireless Systems"
        subtitle="RF fundamentals and best practices for reliable performance."
        open={!!open.wireless}
        onToggle={() => toggle("wireless")}
      >
        <Banner
          title="Wireless Frequency Fundamentals"
          subtitle="How wireless systems work — and how to keep your signal clear and reliable."
        />
        <Prose>
          Wireless mic systems transmit audio using radio frequencies (RF) instead
          of cables. A transmitter (handheld or bodypack) sends your signal to a
          receiver, which feeds your mixer or sound system — but wireless
          systems must share limited RF spectrum with TV broadcasts, mobile
          devices, and nearby systems.
        </Prose>
        <Flow steps={["Transmitter", "RF )))", "Receiver", "Mixer / PA"]} />
        <div className="space-y-3">
          <Subhead>Common Wireless Challenges</Subhead>
          <Pillars
            items={[
              {
                title: "Interference",
                lines: [
                  "Overlapping signals from other devices can disrupt performance — common in busy RF environments.",
                ],
              },
              {
                title: "Dropouts",
                lines: [
                  "Signal loss from distance, obstacles, or weak RF causes unstable audio on long or obstructed setups.",
                ],
              },
              {
                title: "Limited Spectrum",
                lines: [
                  "Fewer frequencies as more devices share the RF space — coordination matters in dense productions and cities.",
                ],
              },
            ]}
          />
        </div>
        <div className="space-y-3">
          <Subhead>How Coordination Works</Subhead>
          <Bullets
            items={[
              "Scan the environment: systems scan for existing RF activity to find open frequencies.",
              "Use compatible channels: preset frequency groups are designed to work together.",
              "Space frequencies properly: even non-matching frequencies must be spaced to avoid interaction.",
              "Use coordination software: advanced setups calculate clean frequencies across many systems.",
            ]}
          />
          <Subhead>Understanding Frequency Coordination</Subhead>
          <Prose>
            Wireless systems typically operate in the UHF spectrum (470&ndash;608
            MHz), shared with TV broadcasts. Most wireless mics operate in the
            470&ndash;700 MHz range and must work in the open space between active
            signals.
          </Prose>
          <Table
            head={["Range", "Use"]}
            rows={[
              ["200 – 470 MHz", "TV broadcast"],
              ["470 – 608 MHz", "Wireless mics available space"],
              ["608 MHz – 2.4 GHz", "Wi-Fi & Bluetooth"],
              ["2.4 GHz – 5 GHz", "Other RF devices"],
            ]}
          />
        </div>
        <div className="space-y-3">
          <Subhead>Best Practices for Reliable Performance</Subhead>
          <Pillars
            cols={4}
            items={[
              {
                title: "Scan Before Use",
                lines: ["Check for open frequencies before powering systems."],
              },
              {
                title: "Optimize Antennas",
                lines: ["Keep antennas clear of metal and avoid crowding."],
              },
              {
                title: "Distance & Line of Sight",
                lines: [
                  "Stay within range and keep transmitters and receivers unobstructed.",
                ],
              },
              {
                title: "Coordinate Systems",
                lines: ["Use compatible frequencies or coordination tools."],
              },
            ]}
          />
          <Subhead>System Count by Application</Subhead>
          <Pillars
            items={[
              {
                title: "1–4 Systems",
                tag: "Controlled environments",
                lines: [
                  "Small venues, classrooms, meeting spaces. Simple setup; auto-scan is usually sufficient.",
                ],
              },
              {
                title: "5–12 Systems",
                tag: "Shared RF environments",
                lines: [
                  "Houses of worship, event spaces, small theaters. Requires coordinated frequencies and careful antenna spacing.",
                ],
              },
              {
                title: "12+ Systems",
                tag: "Mission-critical",
                lines: [
                  "Touring, broadcast, large venues. Advanced coordination essential for high channel counts.",
                ],
              },
            ]}
          />
          <Table
            head={["Technology", "How it works"]}
            rows={[
              [
                "Analog wireless",
                "Sends audio as a continuous RF signal — more susceptible to noise and interference.",
              ],
              [
                "Digital wireless",
                "Converts audio to data before transmission — more consistent quality, efficient spectrum use, better interference resistance.",
              ],
            ]}
          />
          <Tip
            title="Advanced — WMAS"
            body="Wireless Multichannel Audio System (WMAS) runs multiple audio channels within a single wideband RF transmission instead of one frequency per mic. Benefits: higher channel density, simpler coordination, and better use of limited RF space."
          />
        </div>
      </Section>

      {/* 6. Lighting & DMX ------------------------------------------------ */}
      <Section
        icon={Lightbulb}
        title="Lighting & DMX"
        subtitle="DMX fundamentals, universes, and system expansion."
        open={!!open.dmx}
        onToggle={() => toggle("dmx")}
      >
        <Banner
          title="DMX Fundamentals"
          subtitle="Learn the basics of DMX and how lighting systems communicate."
        />
        <Prose>
          Digital Multiplex (DMX) is the standard protocol used to control lighting
          fixtures, dimmers, and effects. A controller or console sends
          instructions; fixtures receive and respond; changes happen instantly
          across the system. Signal path: Controller &rsaquo; DMX connection
          &rsaquo; fixtures (daisy-chained).
        </Prose>
        <Pillars
          items={[
            {
              title: "Data Flows Continuously",
              lines: [
                "The controller streams channel data through the whole cable run via DMX Out.",
              ],
            },
            {
              title: "Each Fixture Listens",
              lines: [
                "Fixtures respond only to their assigned start address and ignore all other data.",
              ],
            },
            {
              title: "Fixtures Act Independently",
              lines: [
                "All fixtures share the cable, but each responds only to its own channels.",
              ],
            },
          ]}
        />
        <Subhead>DMX Signal Flow</Subhead>
        <Flow
          steps={[
            "Lighting Controller",
            "Cue Triggered",
            "Signal via DMX Out",
            "LED Wash — Addr 001",
            "Moving Head — Addr 010",
            "LED Fixture — Addr 025",
            "120Ω Terminator",
          ]}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Subhead>DMX Channels & Addressing</Subhead>
            <Prose>
              A DMX channel controls one function of a fixture — intensity
              (dimmer), color, or movement (pan/tilt). More advanced fixtures use
              more channels. Fixtures are assigned a start address that determines
              where they listen in the chain (e.g. Fixture 1: 001, Fixture 2: 010,
              Fixture 3: 025) and respond only to their own channels.
            </Prose>
          </div>
          <div className="space-y-2">
            <Subhead>DMX Quick Tips</Subhead>
            <Bullets
              items={[
                "Avoid overlapping addresses — shared channels cause erratic behavior",
                "Label fixtures during setup",
                "Plan channel usage in advance",
                "Always place a 120Ω terminator in the DMX Out of the final fixture",
              ]}
            />
          </div>
        </div>
        <Tip
          title="DMX Termination Matters"
          body="The last fixture in a DMX chain should be terminated with a 120Ω terminator. Without it, signal reflections can cause flickering or erratic behavior, and longer cable runs become less reliable."
        />
        <div className="space-y-3">
          <Subhead>Wireless DMX (WDMX)</Subhead>
          <Prose>
            WDMX transmits control data over the air without physical DMX cables,
            adding flexibility to how a system is deployed. Common uses: temporary
            setups and live events, historic venues with limited cabling, and
            hard-to-reach fixtures (truss, ceiling, architectural).
          </Prose>
          <Pillars
            cols={2}
            items={[
              {
                title: "Requires a clear signal path",
                lines: [
                  "Obstructions between transmitter and receiver can degrade performance.",
                ],
              },
              {
                title: "Watch for RF interference",
                lines: ["Nearby wireless systems can affect the signal."],
              },
              {
                title: "Use strategically",
                lines: [
                  "Not always a full cable replacement in mission-critical scenarios.",
                ],
              },
            ]}
          />
        </div>
        <div className="space-y-3">
          <Subhead>DMX Universes & System Expansion</Subhead>
          <Prose>
            A DMX universe is a single DMX data stream with a maximum of 512
            channels. Every fixture in that universe shares the same data line. As
            systems grow — especially with LED fixtures and moving lights —
            channel usage climbs fast and you&rsquo;ll need additional universes.
            Organizing them logically (e.g. Universe 1: front wash, Universe 2:
            moving fixtures, Universe 3: LED effects & pixel mapping) streamlines
            programming.
          </Prose>
          <Tip
            title="Network-Based Control — Beyond DMX"
            body="For larger systems, lighting control can extend beyond traditional DMX using network protocols like Art-Net or sACN (Streaming ACN). These transmit multiple universes over standard Ethernet, making it easier to scale and manage large rigs from a single network."
          />
        </div>
      </Section>

      {/* 7. Networked AV -------------------------------------------------- */}
      <Section
        icon={Network}
        title="Networked AV & AVoIP"
        subtitle="AV over IP, live streaming, and network design."
        open={!!open.network}
        onToggle={() => toggle("network")}
      >
        <Banner
          title="Networked AV Systems"
          subtitle="Send audio anywhere on your network. Learn the basics of audio networking including Dante systems."
        />
        <Prose>
          Networked audio lets multiple channels travel over a standard Ethernet
          network instead of individual analog cables — a single connection
          can carry many channels at once. For example, stage mics can route
          through a stagebox to front-of-house, monitors, and a recording system,
          all over one network.
        </Prose>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Subhead>What is Dante?</Subhead>
            <Prose>
              Dante (Digital Audio Network Through Ethernet) is a widely used audio
              networking protocol. It lets mixers, stageboxes, amplifiers, and DSPs
              send and receive audio over a shared, low-latency network. Devices are
              automatically discovered and routed in software — each device
              subscribes only to the channels it needs (similar to how DMX fixtures
              listen to assigned addresses).
            </Prose>
          </div>
          <div className="space-y-2">
            <Subhead>How Dante Works</Subhead>
            <Bullets
              items={[
                "Audio is converted to digital data",
                "Data is transmitted over Ethernet",
                "Devices subscribe and receive the channels they need",
              ]}
            />
          </div>
        </div>
        <Table
          head={["Consideration", "Description"]}
          rows={[
            ["Bandwidth", "More channels require more network capacity. Gigabit networks are standard."],
            ["Latency", "A small delay occurs as audio travels. Dante's settings balance performance and stability."],
            ["Clocking", "All devices must stay synchronized. Dante manages this automatically."],
            ["Network hardware", "Use quality switches. Dedicated networks improve reliability."],
          ]}
        />
        <Tip
          title="Quick Tips"
          body="Label devices clearly in Dante management software, keep audio networks separate from general IT traffic, and plan your network layout before deployment."
        />
        <Banner title="AVoIP & Live Streaming" subtitle="Extend networked audio to video, audio, and control across your network." />
        <Prose>
          Audio Video over IP (AVoIP) takes the principles of networked audio and
          expands them to carry video, audio, and control over a network —
          replacing long cable runs with flexible routing across standard Ethernet.
          AV signals are encoded into data, transmitted across the network, and
          decoded at the destination, so sources can reach multiple displays without
          dedicated cabling.
        </Prose>
        <Flow steps={["Source", "Encoder", "Network", "Decoder", "Display"]} />
        <div className="space-y-3">
          <Subhead>Streaming Basics</Subhead>
          <Prose>
            Streaming delivers AV content beyond your local network to platforms like
            YouTube, Zoom, and social media, using encoder software to convert and
            deliver to your platform of choice — reaching online and in-person
            audiences at the same time.
          </Prose>
          <Flow
            steps={["Camera", "Encoder Software", "Streaming Platform", "Online Viewer"]}
          />
          <Bullets
            items={[
              "Upload bandwidth determines stream quality",
              "Encoding settings impact clarity and delay",
              "Platform requirements vary",
            ]}
          />
        </div>
        <Tip
          title="Key AVoIP Considerations"
          body="Video needs significantly more bandwidth (higher resolutions increase demand). Lower compression offers higher quality but needs more bandwidth. Lower-latency systems are preferred for real-time video — test your network before events and leave bandwidth headroom."
        />
      </Section>

      {/* 8. Glossary ------------------------------------------------------ */}
      <Section
        icon={BookOpen}
        title="Definitions Glossary"
        subtitle="Reference terms across audio, video, lighting, and networking."
        open={!!open.glossary}
        onToggle={() => toggle("glossary")}
      >
        <Prose>
          Audio, video, lighting, and networking systems rely on specialized
          terminology. This glossary explains common terms used throughout modern AV
          systems.
        </Prose>
        <DefGroup
          heading="Audio"
          terms={[
            { term: "Amplifier", def: "Increases signal power to drive loudspeakers." },
            { term: "Balanced Audio", def: "Transmission using two signal conductors and a ground to reduce noise." },
            { term: "Bus", def: "A signal path that combines multiple audio channels into a single output." },
            { term: "Channel", def: "A single input path on a mixer used to control one audio source." },
            { term: "Compression", def: "Reduces the difference between the loudest and quietest parts of a signal." },
            { term: "Decibel (dB)", def: "A unit used to measure signal level, loudness, or gain." },
            { term: "Delay", def: "A device that delays an output signal by a specific time." },
            { term: "DSP", def: "Digital Signal Processor — processes audio with EQ, delay, and dynamics." },
            { term: "Equalization (EQ)", def: "Adjustment of specific frequency ranges within a signal." },
            { term: "Feedback", def: "A high-pitched sound caused when a mic picks up sound from a speaker." },
            { term: "Gain", def: "The amount of amplification applied to an incoming signal." },
            { term: "Headroom", def: "The available signal level before distortion occurs." },
            { term: "Hertz (Hz)", def: "Unit measuring how frequently a signal oscillates per second." },
            { term: "Latency", def: "The delay between when a signal enters a system and when it is heard." },
            { term: "Matrix Mixer", def: "Routes inputs to outputs with independent level control." },
            { term: "Polar Pattern", def: "The directional sensitivity of a microphone." },
            { term: "Preamplifier (Preamp)", def: "Boosts low-level signals such as mics and instrument pickups." },
            { term: "Radio Frequency (RF)", def: "Electromagnetic signals transmitted through the air for wireless." },
            { term: "Signal Chain", def: "The complete path an audio signal travels from source to output." },
            { term: "Sound Pressure Level (SPL)", def: "Measurement of sound amplitude in the air, in decibels." },
            { term: "Stagebox", def: "Remote I/O device that connects stage mics to a mixer." },
            { term: "Wireless System", def: "Transmits audio signals using RF instead of cables." },
          ]}
        />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
          <Eyebrow>How audio moves through a system</Eyebrow>
          <div className="mt-2">
            <Flow
              steps={[
                "Source",
                "Input/Preamp",
                "Mixer",
                "Processing",
                "Output Routing",
                "Amplification",
                "Speakers",
              ]}
            />
          </div>
        </div>
        <DefGroup
          heading="Video"
          terms={[
            { term: "Aliasing", def: "When smooth curves or lines appear jagged on a lower-resolution device." },
            { term: "ANSI Lumen", def: "A standard measurement of projector brightness." },
            { term: "Aspect Ratio", def: "The proportional relationship between a display's width and height." },
            { term: "Bitrate", def: "The amount of data transmitted per second in a digital video stream." },
            { term: "Capture Card", def: "Captures and converts video signals to digital." },
            { term: "Chroma Key", def: "Designating a key color (e.g. green) into which other video can be inserted." },
            { term: "Color Space", def: "The range of colors a video system can capture, process, or display." },
            { term: "Edge Blending", def: "Overlapping projectors edge to edge for a seamless transition." },
            { term: "Encoder", def: "Converts video into a digital format for streaming or recording." },
            { term: "Frame Rate", def: "The number of video frames displayed per second." },
            { term: "Gamma", def: "The transfer relationship between a projector's input level and output brightness." },
            { term: "HDMI", def: "A digital interface used to transmit high-definition video and audio." },
            { term: "HDR", def: "High Dynamic Range — expands contrast and color range for more detail." },
            { term: "NDI", def: "Network Device Interface — transmits video over standard IP networks." },
            { term: "Pan-Tilt-Zoom (PTZ)", def: "A camera that can rotate, tilt, and zoom remotely." },
            { term: "Pixel Pitch", def: "Distance between pixels in an LED wall, in millimeters." },
            { term: "Resolution", def: "Number of pixels displayed in a video image." },
            { term: "Scaler", def: "Converts video signals to different resolutions or formats." },
            { term: "SDI", def: "Serial Digital Interface — transmits uncompressed digital video." },
            { term: "Signal Routing", def: "Directing video signals to specific destinations." },
            { term: "Video Switcher", def: "Selects and transitions between multiple video sources." },
          ]}
        />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-4">
          <Eyebrow>How video moves through a system</Eyebrow>
          <div className="mt-2">
            <Flow
              steps={[
                "Camera",
                "Video Connection",
                "Video Switcher",
                "Processing",
                "Encoder",
                "Signal Routing",
                "Display & Livestream",
              ]}
            />
          </div>
        </div>
        <DefGroup
          heading="Lighting"
          terms={[
            { term: "Beam Angle", def: "The angle at which light is emitted, affecting the size of the lit area." },
            { term: "Color Temperature", def: "Light color appearance, typically expressed in Kelvin." },
            { term: "Cue", def: "A programmed lighting change triggered at a specific moment." },
            { term: "DMX", def: "Digital Multiplex — protocol to control fixtures, dimmers, and effects." },
            { term: "DMX Address", def: "A numerical identifier so a fixture receives specific commands." },
            { term: "DMX Universe", def: "A group of 512 DMX control channels." },
            { term: "Dimmer", def: "Controls the intensity of a lighting fixture." },
            { term: "Fixture", def: "A lighting instrument that produces and controls illumination." },
            { term: "Gobo", def: "A patterned template inside a fixture to project shapes or textures." },
            { term: "LED Fixture", def: "A fixture that uses light-emitting diodes as its light source." },
            { term: "Lighting Console", def: "A control surface to program and operate fixtures." },
            { term: "Lighting Rig", def: "A structure that supports fixtures above a stage or area." },
            { term: "Lighting Scene", def: "A stored combination of levels and colors for a moment in a show." },
            { term: "Lux", def: "A unit measuring light intensity on a surface." },
            { term: "Moving Head", def: "A fixture with motorized pan and tilt movement." },
            { term: "Pan / Tilt", def: "Horizontal (pan) and vertical (tilt) movement of a fixture." },
            { term: "Pixel Mapping", def: "Controls individual LEDs within fixtures for animated effects." },
            { term: "Spotlight", def: "A focused beam used to highlight a performer or object." },
            { term: "Wash Light", def: "Evenly illuminates a large area with soft light." },
          ]}
        />
        <DefGroup
          heading="Networking"
          terms={[
            { term: "AVoIP", def: "Transmits audio and video signals across standard computer networks." },
            { term: "Bandwidth", def: "The amount of data that can be transmitted over a connection in a given time." },
            { term: "Dante", def: "A widely used protocol for transmitting digital audio (and video) over Ethernet." },
            { term: "DHCP", def: "Automatically assigns IP addresses to devices on a network." },
            { term: "Ethernet", def: "A common networking standard used to connect devices in local networks." },
            { term: "IP Address", def: "A unique numerical identifier assigned to a device on a network." },
            { term: "LAN", def: "Local Area Network — connects devices within a limited area." },
            { term: "Latency", def: "The delay between when data is transmitted and when it is received." },
            { term: "Multicast", def: "Sends one data stream to multiple devices at the same time." },
            { term: "Network Switch", def: "Connects network devices and directs data between them." },
            { term: "PoE", def: "Power over Ethernet — delivers power and data through one Ethernet cable." },
            { term: "Quality of Service (QoS)", def: "Prioritizes certain types of traffic for better performance." },
            { term: "Router", def: "Directs network traffic between different networks." },
            { term: "Subnet", def: "A segmented portion of a larger network used to organize devices." },
            { term: "Unicast", def: "Sends data from one device to a single destination." },
            { term: "VLAN", def: "A logical network segment that separates traffic on the same physical network." },
          ]}
        />
      </Section>
    </div>
  );
}
