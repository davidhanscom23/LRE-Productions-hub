"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { COMPANY } from "@/lib/company";
import {
  type ApplyTrack,
  type ApplyTrackSlug,
} from "@/lib/hiring/apply-tracks";
import {
  GENERAL_HIRING_ROLE_INTERESTS,
} from "@/lib/types/hiring-applications";
import { submitHiringApplicationAction } from "@/app/apply/actions";
import "@/app/apply/apply.css";

const fieldClass =
  "h-11 w-full rounded-md border border-[var(--apply-line)] bg-white px-3 text-base text-[var(--apply-ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--apply-muted)]/70 focus:border-[var(--apply-brand)] focus:ring-2 focus:ring-[var(--apply-brand)]/20";

const textareaClass =
  "w-full rounded-md border border-[var(--apply-line)] bg-white px-3 py-2.5 text-base text-[var(--apply-ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--apply-muted)]/70 focus:border-[var(--apply-brand)] focus:ring-2 focus:ring-[var(--apply-brand)]/20";

type ApplyTrackFormProps = {
  track: ApplyTrack;
};

export function ApplyTrackForm({ track }: ApplyTrackFormProps) {
  const isGeneral = track.slug === "general";
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleInterest, setRoleInterest] = useState(
    isGeneral ? "" : track.roleInterest,
  );
  const [message, setMessage] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const answeredCount = useMemo(
    () => track.questions.filter((q) => answers[q.id]).length,
    [answers, track.questions],
  );

  const canSubmit =
    Boolean(fullName.trim()) &&
    (isGeneral || answeredCount === track.questions.length);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitHiringApplicationAction({
        fullName,
        email,
        phone,
        roleInterest: isGeneral ? roleInterest : track.roleInterest,
        message,
        resumeUrl,
        assessmentTrack: track.slug as ApplyTrackSlug,
        assessmentAnswers: isGeneral ? {} : answers,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <div className="apply-page min-h-full">
      <div className="border-b border-[var(--apply-line)] bg-[var(--apply-ink)] px-6 py-5 text-white sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={COMPANY.displayName}
            className="apply-hero-logo h-8 w-auto max-w-[10rem] object-contain"
          />
          <Link
            href="/apply"
            className="text-xs font-medium text-white/75 transition-colors hover:text-white"
          >
            ← All tracks
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-12">
        {done ? (
          <div className="apply-anim-rise space-y-5 border border-[var(--apply-line)] bg-white p-6 sm:p-8">
            <p className="apply-display text-3xl font-bold">
              Application received
            </p>
            <p className="text-[var(--apply-muted)]">
              Thanks for applying
              {track.slug !== "general" ? ` to ${track.label}` : ""}. Our team
              reviews every submission and will follow up by email.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={COMPANY.website}
                className="inline-flex h-11 items-center justify-center bg-[var(--apply-ink)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Back to the site
              </a>
              <Link
                href="/apply"
                className="inline-flex h-11 items-center justify-center border border-[var(--apply-line)] px-5 text-sm font-medium text-[var(--apply-ink)] hover:border-[var(--apply-brand)]"
              >
                See other tracks
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="apply-anim-rise">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--apply-brand)]">
                {isGeneral ? "General application" : `${track.shortLabel} track`}
              </p>
              <h1 className="apply-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {track.assessmentTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-[var(--apply-muted)]">
                {track.assessmentIntro}
              </p>
              {!isGeneral ? (
                <p className="mt-2 text-sm text-[var(--apply-muted)]">
                  Answered {answeredCount} of {track.questions.length}
                </p>
              ) : null}
            </div>

            <div className="apply-anim-rise mt-8 space-y-8">
              <section className="space-y-4 border border-[var(--apply-line)] bg-white p-5 sm:p-6">
                <h2 className="apply-display text-lg font-bold">About you</h2>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--apply-muted)]">
                    Full name
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={fieldClass}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--apply-muted)]">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={fieldClass}
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--apply-muted)]">
                      Phone (optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={fieldClass}
                      autoComplete="tel"
                    />
                  </div>
                </div>
                {isGeneral ? (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--apply-muted)]">
                      Role interest
                    </label>
                    <select
                      value={roleInterest}
                      onChange={(e) => setRoleInterest(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Select…</option>
                      {GENERAL_HIRING_ROLE_INTERESTS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--apply-muted)]">
                    {isGeneral
                      ? "Message"
                      : "Anything else we should know? (optional)"}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={isGeneral ? 4 : 3}
                    className={textareaClass}
                    placeholder={
                      isGeneral
                        ? "Experience, availability, why you’re a fit…"
                        : "Availability, related experience, or a note for the team…"
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--apply-muted)]">
                    Resume / portfolio URL (optional)
                  </label>
                  <input
                    type="url"
                    value={resumeUrl}
                    onChange={(e) => setResumeUrl(e.target.value)}
                    className={fieldClass}
                    placeholder="https://"
                  />
                </div>
              </section>

              {!isGeneral
                ? track.questions.map((q, index) => (
                    <section
                      key={q.id}
                      className="border border-[var(--apply-line)] bg-white p-5 sm:p-6"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--apply-muted)]">
                        Scenario {index + 1}
                      </p>
                      <p className="mt-2 text-base font-medium leading-snug text-[var(--apply-ink)]">
                        {q.prompt}
                      </p>
                      <ul className="mt-4 space-y-2">
                        {q.options.map((opt) => {
                          const selected = answers[q.id] === opt.id;
                          return (
                            <li key={opt.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: opt.id,
                                  }))
                                }
                                className={[
                                  "w-full rounded-md border px-3 py-3 text-left text-sm leading-snug transition-colors",
                                  selected
                                    ? "border-[var(--apply-brand)] bg-[var(--apply-brand)]/5 text-[var(--apply-ink)]"
                                    : "border-[var(--apply-line)] bg-white text-[var(--apply-ink)] hover:border-[var(--apply-brand)]/50",
                                ].join(" ")}
                              >
                                {opt.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))
                : null}

              {error ? <p className="text-sm text-red-700">{error}</p> : null}

              <button
                type="button"
                disabled={pending || !canSubmit}
                onClick={submit}
                className="inline-flex h-12 w-full items-center justify-center bg-[var(--apply-brand)] px-4 text-sm font-semibold tracking-wide text-white transition-[background-color,opacity] hover:bg-[var(--apply-brand-deep)] disabled:opacity-50 sm:w-auto sm:min-w-[14rem]"
              >
                {pending ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--apply-line)] px-6 py-8 text-center text-xs text-[var(--apply-muted)] sm:px-10">
        © {new Date().getFullYear()} {COMPANY.legalName} · {COMPANY.address}
      </footer>
    </div>
  );
}
