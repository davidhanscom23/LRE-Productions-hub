import type { Metadata } from "next";
import { Download } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PrintButton } from "@/components/speaker-guide/print-button";
import { COMPANY } from "@/lib/company";
import {
  CHECKLIST,
  DAY_OF_SECTION,
  FIVE_THINGS,
  MIC_SECTION,
  SLIDES_SECTION,
  SPEAKER_GUIDE_INTRO,
  SPEAKER_GUIDE_PDF,
  type Bullet,
  type Callout,
  type DoAvoid,
} from "@/lib/speaker-guide/content";

export const metadata: Metadata = {
  title: "A Speaker's Guide to the AV Booth — LRE Productions",
  description:
    "Simple things speakers and presenters can do before they step on stage: microphones, slides, clickers, and working with the AV team.",
  robots: { index: false, follow: false },
};

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="mt-12 border-b-2 border-[var(--brand)] pb-2 print:mt-8">
      <p className="text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
        {kicker}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
    </header>
  );
}

function CalloutBox({ title, body }: Callout) {
  return (
    <aside className="mt-6 rounded-lg border-l-4 border-[var(--brand)] bg-[var(--surface-hover)] px-4 py-3 break-inside-avoid">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
    </aside>
  );
}

function BulletList({ items }: { items: Bullet[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2.5 pl-5 text-sm leading-relaxed marker:text-[var(--brand)]">
      {items.map((b) => (
        <li key={(b.lead ?? "") + b.text}>
          {b.lead ? <strong>{b.lead} </strong> : null}
          {b.text}
        </li>
      ))}
    </ul>
  );
}

function DoAvoidTable({ title, do: doItems, avoid }: DoAvoid) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-3 grid overflow-hidden rounded-lg border border-[var(--border)] sm:grid-cols-2">
        <div className="bg-emerald-50 p-4 text-neutral-900 dark:bg-emerald-950/40 dark:text-neutral-100">
          <p className="text-xs font-bold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
            Do
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {doItems.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="bg-[var(--brand-soft)] p-4 text-neutral-900 dark:text-neutral-100">
          <p className="text-xs font-bold tracking-wide text-[var(--brand)] uppercase">
            Please avoid
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {avoid.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function SpeakerGuidePage() {
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-16 sm:px-6 print:max-w-none print:px-0">
        <BrandLogo className="h-20 w-auto object-contain" />
        <div className="mt-3 h-1 w-full bg-[var(--brand)]" />

        <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-[var(--brand)] uppercase">
          {SPEAKER_GUIDE_INTRO.kicker}
        </p>
        <h1 className="mt-2 text-4xl leading-tight font-bold tracking-tight">
          {SPEAKER_GUIDE_INTRO.title}
        </h1>
        <p className="mt-3 text-lg text-[var(--muted)]">
          {SPEAKER_GUIDE_INTRO.lead}
        </p>

        <div className="mt-5 flex flex-wrap gap-2 print:hidden">
          <a
            href={SPEAKER_GUIDE_PDF}
            download
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <PrintButton />
        </div>

        <p className="mt-6 text-sm leading-relaxed">{SPEAKER_GUIDE_INTRO.body}</p>

        <SectionHead kicker="The five-second version" title="If you only remember five things" />
        <ol className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {FIVE_THINGS.map((t, i) => (
            <li key={t.title} className="flex gap-4 px-4 py-3 break-inside-avoid">
              <span className="text-2xl font-bold text-[var(--brand)]">{i + 1}</span>
              <div>
                <p className="font-semibold">{t.title}</p>
                <p className="text-sm text-[var(--muted)]">{t.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <SectionHead kicker="Section 1" title="Microphone Basics" />
        <CalloutBox {...MIC_SECTION.myth} />
        <DoAvoidTable {...MIC_SECTION.handheld} />
        <DoAvoidTable {...MIC_SECTION.lav} />
        <CalloutBox {...MIC_SECTION.live} />

        <SectionHead kicker="Section 2" title="Slides, Video, and Clickers" />
        <h3 className="mt-6 text-lg font-semibold">{SLIDES_SECTION.before.title}</h3>
        <BulletList items={SLIDES_SECTION.before.items} />
        <h3 className="mt-6 text-lg font-semibold">{SLIDES_SECTION.notes.title}</h3>
        <BulletList items={SLIDES_SECTION.notes.items} />
        <CalloutBox {...SLIDES_SECTION.supporting} />

        <SectionHead kicker="Section 3" title="Day-of: Working With Your Tech Team" />
        <BulletList items={DAY_OF_SECTION.items} />
        <h3 className="mt-6 text-lg font-semibold">{DAY_OF_SECTION.wrong.title}</h3>
        <BulletList items={DAY_OF_SECTION.wrong.items} />

        <h3 className="mt-8 text-lg font-semibold">{DAY_OF_SECTION.quickRef.title}</h3>
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)] text-sm break-inside-avoid">
          <div className="grid grid-cols-2 bg-[var(--surface-hover)] px-3 py-2 font-semibold">
            <span>What we often see</span>
            <span>What makes it smoother</span>
          </div>
          {DAY_OF_SECTION.quickRef.rows.map(([a, b]) => (
            <div
              key={a}
              className="grid grid-cols-2 gap-3 border-t border-[var(--border)] px-3 py-2"
            >
              <span>{a}</span>
              <span className="text-[var(--muted)]">{b}</span>
            </div>
          ))}
        </div>

        <div className="break-before-page">
          <SectionHead kicker="Your checklist" title="Print It. Tuck It in Your Bag." />
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {CHECKLIST.map((group) => (
              <section key={group.title} className="break-inside-avoid">
                <h3 className="font-semibold">{group.title}</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-[var(--foreground)]/50"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <footer className="mt-12 border-t border-[var(--border)] pt-4 text-sm">
          <p>
            <strong>{COMPANY.displayName}</strong> &nbsp;|&nbsp; Tiverton, RI
            &nbsp;|&nbsp;{" "}
            <a href={COMPANY.emailHref} className="text-[var(--brand)] underline">
              {COMPANY.email}
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
