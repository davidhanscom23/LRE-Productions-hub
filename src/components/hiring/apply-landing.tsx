"use client";

import Link from "next/link";
import { ArrowRight, Cable, Building2, Heart, Flag } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { APPLY_FEATURED_TRACKS } from "@/lib/hiring/apply-tracks";
import "@/app/apply/apply.css";

const TRACK_ICONS = {
  av: Cable,
  corporate: Building2,
  wedding: Heart,
  golf: Flag,
} as const;

export function ApplyLanding() {
  return (
    <div className="apply-page">
      <header className="relative flex min-h-[72svh] flex-col overflow-hidden text-white sm:min-h-[78svh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/apply-hero.jpg"
          alt=""
          className="apply-anim-ken absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(105deg,rgba(10,8,6,0.88)_0%,rgba(10,8,6,0.55)_48%,rgba(10,8,6,0.35)_100%)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(193,153,96,0.32),transparent_55%)]"
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col px-6 pb-10 pt-8 sm:px-10 lg:px-16">
          <div className="flex items-center justify-between gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={COMPANY.displayName}
              className="apply-hero-logo apply-anim-fade-up h-10 w-auto max-w-[11rem] object-contain sm:h-12 sm:max-w-[14rem]"
            />
            <Link
              href={COMPANY.website}
              className="apply-anim-fade-up text-xs font-medium tracking-wide text-white/75 transition-colors hover:text-white"
            >
              videntproductions.com
            </Link>
          </div>

          <div className="mt-auto max-w-2xl pb-6 pt-20 sm:pb-10 sm:pt-28">
            <p className="apply-anim-fade-up apply-display text-sm font-semibold uppercase tracking-[0.22em] text-white/70">
              Now hiring
            </p>
            <h1 className="apply-anim-fade-up-delay apply-display mt-4 text-[clamp(2.4rem,7vw,4.5rem)] font-extrabold leading-[0.95] tracking-tight text-white">
              Join the Vident crew
            </h1>
            <p className="apply-anim-fade-up-delay mt-5 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">
              Pick the department you’re interested in and answer a few real
              scenarios — about five minutes, and it helps us get you to the
              right training faster.
            </p>
            <div className="apply-anim-fade-up-delay-2 mt-8">
              <a
                href="#tracks"
                className="inline-flex h-12 items-center justify-center bg-[var(--apply-brand)] px-7 text-sm font-semibold tracking-wide text-white transition-[background-color,transform] hover:bg-[var(--apply-brand-deep)] active:translate-y-px"
              >
                Choose a track
              </a>
            </div>
          </div>
        </div>
      </header>

      <section
        id="tracks"
        className="scroll-mt-6 px-6 py-14 sm:px-10 sm:py-16 lg:px-16"
      >
        <div className="mx-auto max-w-5xl">
          <div className="max-w-xl">
            <h2 className="apply-display text-3xl font-bold tracking-tight sm:text-4xl">
              Four main departments
            </h2>
            <p className="mt-3 text-[var(--apply-muted)]">
              Each track has a short working-style assessment built from
              on-site moments we see every week.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {APPLY_FEATURED_TRACKS.map((track) => {
              const Icon = TRACK_ICONS[track.slug as keyof typeof TRACK_ICONS];
              return (
                <Link
                  key={track.slug}
                  href={`/apply/${track.slug}`}
                  className="group flex flex-col border border-[var(--apply-line)] bg-white p-5 shadow-[0_16px_40px_-28px_rgba(18,16,14,0.35)] transition-[border-color,transform] hover:border-[var(--apply-brand)] hover:-translate-y-0.5"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center bg-[var(--apply-brand)]/10 text-[var(--apply-brand)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="apply-display mt-4 text-xl font-bold text-[var(--apply-ink)]">
                    {track.shortLabel}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--apply-muted)]">
                    {track.blurb}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--apply-brand)]">
                    Apply as {track.shortLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-[var(--apply-muted)]">
              Interested in Office or something else?{" "}
              <Link
                href="/apply/general"
                className="font-medium text-[var(--apply-brand)] underline-offset-2 hover:underline"
              >
                Use the general application
              </Link>
              .
            </p>
            <p className="mt-3 text-xs text-[var(--apply-muted)]">
              Already on the team?{" "}
              <Link
                href="/login"
                className="text-[var(--apply-brand)] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--apply-line)] px-6 py-8 text-center text-xs text-[var(--apply-muted)] sm:px-10">
        © {new Date().getFullYear()} {COMPANY.legalName} · {COMPANY.address}
      </footer>
    </div>
  );
}
