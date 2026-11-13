import type { Metadata } from "next";
import { PrintButton } from "@/components/speaker-guide/print-button";

export const metadata: Metadata = {
  title: "LED Wall Layouts (64 tiles) — LRE Productions",
  description:
    "Seven ways to arrange 64 LED tiles (500 mm x 500 mm each), with metric and imperial sizes for every layout.",
  robots: { index: false, follow: false },
};

const ACCENT = "#e0393e";

type Layout = {
  cols: number;
  rows: number;
  tag: string;
  metric: string;
  imperial: string;
  approx: string;
  tile: number;
  gap: number;
};

const LAYOUTS: Layout[] = [
  { cols: 8, rows: 8, tag: "Square · 1:1", metric: "4.0 m × 4.0 m", imperial: "13.12 ft × 13.12 ft", approx: "approx. 13 ft 1.5 in × 13 ft 1.5 in", tile: 28, gap: 2 },
  { cols: 16, rows: 4, tag: "Wide banner · landscape", metric: "8.0 m × 2.0 m", imperial: "26.25 ft × 6.56 ft", approx: "approx. 26 ft 3 in × 6 ft 7 in", tile: 18, gap: 2 },
  { cols: 4, rows: 16, tag: "Tall pillar · portrait", metric: "2.0 m × 8.0 m", imperial: "6.56 ft × 26.25 ft", approx: "approx. 6 ft 7 in × 26 ft 3 in", tile: 14, gap: 2 },
  { cols: 32, rows: 2, tag: "Ultra-wide strip", metric: "16.0 m × 1.0 m", imperial: "52.49 ft × 3.28 ft", approx: "approx. 52 ft 6 in × 3 ft 3 in", tile: 22, gap: 2 },
  { cols: 64, rows: 1, tag: "Linear strip · ticker style", metric: "32.0 m × 0.5 m", imperial: "104.99 ft × 1.64 ft", approx: "approx. 105 ft × 1 ft 8 in", tile: 11, gap: 1 },
  { cols: 2, rows: 32, tag: "Ultra-tall strip", metric: "1.0 m × 16.0 m", imperial: "3.28 ft × 52.49 ft", approx: "approx. 3 ft 3 in × 52 ft 6 in", tile: 12, gap: 1 },
  { cols: 1, rows: 64, tag: "Vertical tower strip", metric: "0.5 m × 32.0 m", imperial: "1.64 ft × 104.99 ft", approx: "approx. 1 ft 8 in × 105 ft", tile: 6, gap: 1 },
];

const SPLITS: Layout[] = [
  { cols: 8, rows: 4, tag: "Standard pair · 2:1", metric: "4.0 m × 2.0 m", imperial: "13.12 ft × 6.56 ft", approx: "approx. 13 ft 1.5 in × 6 ft 7 in", tile: 22, gap: 2 },
  { cols: 4, rows: 8, tag: "Portrait pair", metric: "2.0 m × 4.0 m", imperial: "6.56 ft × 13.12 ft", approx: "approx. 6 ft 7 in × 13 ft 1.5 in", tile: 18, gap: 2 },
  { cols: 16, rows: 2, tag: "Banner pair", metric: "8.0 m × 1.0 m", imperial: "26.25 ft × 3.28 ft", approx: "approx. 26 ft 3 in × 3 ft 3 in", tile: 14, gap: 1 },
  { cols: 2, rows: 16, tag: "Tall strip pair", metric: "1.0 m × 8.0 m", imperial: "3.28 ft × 26.25 ft", approx: "approx. 3 ft 3 in × 26 ft 3 in", tile: 12, gap: 1 },
  { cols: 32, rows: 1, tag: "Ticker pair", metric: "16.0 m × 0.5 m", imperial: "52.49 ft × 1.64 ft", approx: "approx. 52 ft 6 in × 1 ft 8 in", tile: 9, gap: 1 },
  { cols: 1, rows: 32, tag: "Tower pair", metric: "0.5 m × 16.0 m", imperial: "1.64 ft × 52.49 ft", approx: "approx. 1 ft 8 in × 52 ft 6 in", tile: 7, gap: 1 },
];

function TileGrid({ l }: { l: Layout }) {
  const count = l.cols * l.rows;
  return (
    <div
      role="img"
      aria-label={`${l.cols} by ${l.rows} tile layout`}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${l.cols}, ${l.tile}px)`,
        gridAutoRows: `${l.tile}px`,
        gap: l.gap,
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const r = Math.floor(i / l.cols);
        const c = i % l.cols;
        return (
          <div
            key={i}
            style={{ background: ACCENT, opacity: (r + c) % 2 ? 0.82 : 1 }}
          />
        );
      })}
    </div>
  );
}

export default function LedWallGuidePage() {
  return (
    <div className="min-h-dvh bg-[#0b0b0b] text-[#f5f5f5]">
      <div className="h-2" style={{ background: ACCENT }} />
      <main className="mx-auto max-w-5xl px-5 pt-8 pb-16 sm:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/led-wall-guide-logo.png" alt="LRE Productions" className="h-14 w-auto" />
        <h1 className="mt-6 text-4xl leading-tight font-extrabold tracking-tight uppercase sm:text-6xl">
          7 wall layouts.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[#d0d0d0]">
          With 64 individual tiles at 500 mm × 500 mm each, multiply the tiles across and
          down by 0.5 m (1.64 ft) to size any rectangular or square LED wall.
        </p>
        <div className="mt-5 print:hidden">
          <PrintButton />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["64", "Individual LED tiles"],
            ["500 × 500 mm", "0.5 m × 0.5 m · about 1.64 × 1.64 ft per tile"],
            ["16 m² · 172 ft²", "Total screen area, every layout"],
          ].map(([big, small]) => (
            <div
              key={big}
              className="border border-[#2a2a2a] bg-[#141414] p-5"
              style={{ borderTop: `5px solid ${ACCENT}` }}
            >
              <p className="text-3xl font-extrabold">{big}</p>
              <p className="mt-1 text-sm tracking-wide text-[#b8b8b8] uppercase">{small}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {LAYOUTS.map((l) => (
            <section
              key={`${l.cols}x${l.rows}`}
              className="flex flex-col gap-4 border border-[#2a2a2a] bg-[#141414] p-5 break-inside-avoid"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-3xl font-extrabold">
                  {l.cols} × {l.rows}
                </h2>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: ACCENT }}>
                  {l.tag}
                </p>
              </div>
              <div className="flex min-h-40 items-center justify-center overflow-x-auto border border-[#2a2a2a] bg-[#0b0b0b] p-3">
                <TileGrid l={l} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs tracking-widest text-[#b8b8b8] uppercase">Metric</p>
                  <p className="text-lg font-bold">{l.metric}</p>
                </div>
                <div>
                  <p className="text-xs tracking-widest text-[#b8b8b8] uppercase">Imperial</p>
                  <p className="text-lg font-bold">{l.imperial}</p>
                  <p className="text-xs text-[#b8b8b8]">{l.approx}</p>
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14 break-before-page">
          <h2 className="text-3xl leading-tight font-extrabold tracking-tight uppercase sm:text-5xl">
            Split in half.
            <br />
            Two screens.
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[#d0d0d0]">
            Cut the 64 tiles into two matching 32-tile screens and use them like projector
            screens: one on each side of the stage, showing the same content.
          </p>
          <div className="mt-6 flex items-center justify-center gap-6 overflow-x-auto border border-[#2a2a2a] bg-[#141414] p-6 sm:gap-16">
            <div className="shrink-0"><TileGrid l={SPLITS[0]} /></div>
            <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-end border-t-4 bg-[#1f1f1f] pb-2 text-center text-[10px] tracking-widest text-[#b8b8b8] uppercase" style={{ borderColor: ACCENT }}>
              Stage
            </div>
            <div className="shrink-0"><TileGrid l={SPLITS[0]} /></div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              ["2", "Matching screens"],
              ["32", "Tiles per screen"],
              ["8 m² · 86 ft²", "Area of each screen"],
            ].map(([big, small]) => (
              <div key={big} className="border border-[#2a2a2a] bg-[#141414] p-5" style={{ borderTop: `5px solid ${ACCENT}` }}>
                <p className="text-3xl font-extrabold">{big}</p>
                <p className="mt-1 text-sm tracking-wide text-[#b8b8b8] uppercase">{small}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {SPLITS.map((l) => (
              <section key={`split-${l.cols}x${l.rows}`} className="flex flex-col gap-4 border border-[#2a2a2a] bg-[#141414] p-5 break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-3xl font-extrabold">2 × {l.cols} × {l.rows}</h3>
                  <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: ACCENT }}>{l.tag}</p>
                </div>
                <div className={`flex min-h-40 items-center justify-center gap-4 overflow-x-auto border border-[#2a2a2a] bg-[#0b0b0b] p-3 ${l.rows > l.cols ? "" : "flex-col"}`}>
                  <TileGrid l={l} />
                  <TileGrid l={l} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs tracking-widest text-[#b8b8b8] uppercase">Each screen · metric</p>
                    <p className="text-lg font-bold">{l.metric}</p>
                  </div>
                  <div>
                    <p className="text-xs tracking-widest text-[#b8b8b8] uppercase">Imperial</p>
                    <p className="text-lg font-bold">{l.imperial}</p>
                    <p className="text-xs text-[#b8b8b8]">{l.approx}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-[#b8b8b8]">
          Each layout is drawn to fit its frame, so scale differs between cards.
        </p>
      </main>
    </div>
  );
}
