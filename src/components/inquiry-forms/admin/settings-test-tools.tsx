"use client";

import { useId, useState, useTransition } from "react";
import { CalendarSearch, MapPin } from "lucide-react";
import { testAddress, testDate } from "@/app/(app)/inquiry-forms/actions";
import { formatEasternTimestamp, formatLongDate } from "@/lib/inquiry-forms/dates";
import type { DateVerdict, LocationVerdict } from "@/lib/inquiry-forms/types";
import { Chip, cls, Notice } from "./list-ui";
import {
  DATE_RESULT_LABEL,
  DATE_RESULT_TONE,
  LOCATION_RESULT_LABEL,
  LOCATION_RESULT_TONE,
  formatYmd,
} from "./submissions-format";

/**
 * "Test a date" and "Test an address": run the same server checks a visitor gets, with the SAVED
 * business settings, and show exactly what the visitor would read (plus staff-only details).
 *
 * These render INSIDE the business settings <form>, so they must not be forms themselves: a form in
 * a form is invalid HTML (the server markup breaks hydration) and its submit would bubble into the
 * settings form and save unsaved edits. Each tester is a labeled group; "Check" is a plain button
 * and Enter in its field runs the test and cancels the settings form's implicit submit.
 */
export function SettingsTestTools({ dirty }: { dirty: boolean }) {
  return (
    <div className="space-y-4">
      {dirty ? (
        <Notice tone="info">
          These tests use your saved settings. Save first to test the changes you just made.
        </Notice>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <DateTester />
        <AddressTester />
      </div>
    </div>
  );
}

/** Enter in a tester field runs its check instead of submitting the surrounding settings form. */
function runOnEnter(run: () => void) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    run();
  };
}

function VisitorMessage({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
      <p className="text-xs font-semibold text-[var(--muted)]">What the visitor reads</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--foreground)]">{text}</p>
    </div>
  );
}

function DateTester() {
  const id = useId();
  const [date, setDate] = useState("");
  const [verdict, setVerdict] = useState<DateVerdict | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!date) {
      setError("Pick a date to test.");
      return;
    }
    setError(null);
    setVerdict(null);
    setProblem(null);
    startTransition(async () => {
      try {
        const res = await testDate(date);
        if (!res.ok) setError(res.error);
        else {
          setVerdict(res.verdict);
          setProblem(res.problem ?? null);
        }
      } catch {
        setError("Could not reach the Hub. Check your connection and try again.");
      }
    });
  }

  return (
    <div role="group" aria-labelledby={`${id}-title`} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <h3 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
        <CalendarSearch className="h-4 w-4" aria-hidden="true" />
        Test a date
      </h3>
      <div>
        <label htmlFor={id} className={cls.label}>
          Event date
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id={id}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={runOnEnter(run)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`${cls.input} max-w-[12rem]`}
          />
          <button type="button" onClick={run} className={cls.btnSecondary} disabled={pending} aria-busy={pending}>
            {pending ? "Checking the calendar..." : "Check"}
          </button>
        </div>
      </div>
      <div aria-live="polite" className="space-y-2">
        {error ? (
          <p id={`${id}-error`} className={cls.fieldError}>
            {error}
          </p>
        ) : null}
        {verdict ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={DATE_RESULT_TONE[verdict.result]}>{DATE_RESULT_LABEL[verdict.result]}</Chip>
              {verdict.checkedFor ? (
                <span className="text-sm text-[var(--foreground)]">{formatLongDate(verdict.checkedFor)}</span>
              ) : null}
            </div>
            <VisitorMessage text={verdict.message || "No date check runs (availability is off), so the visitor sees no date message."} />
            {verdict.alternatives?.length ? (
              <p className="text-sm text-[var(--foreground)]">
                Nearby open dates (offered by forms that suggest other dates):{" "}
                {verdict.alternatives.map(formatYmd).join(", ")}
              </p>
            ) : null}
            {problem ? <Notice tone="warn">Staff only: {problem}</Notice> : null}
            <p className="text-xs text-[var(--muted)]">Checked {formatEasternTimestamp(verdict.checkedAt)}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function AddressTester() {
  const id = useId();
  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<LocationVerdict | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!text.trim()) {
      setError("Type a venue, city or address to test.");
      return;
    }
    setError(null);
    setVerdict(null);
    setProblem(null);
    startTransition(async () => {
      try {
        const res = await testAddress(text);
        if (!res.ok) setError(res.error);
        else {
          setVerdict(res.verdict);
          setProblem(res.problem ?? null);
        }
      } catch {
        setError("Could not reach the Hub. Check your connection and try again.");
      }
    });
  }

  return (
    <div role="group" aria-labelledby={`${id}-title`} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <h3 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
        <MapPin className="h-4 w-4" aria-hidden="true" />
        Test an address
      </h3>
      <div>
        <label htmlFor={id} className={cls.label}>
          Venue, city or address
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id={id}
            type="text"
            value={text}
            maxLength={300}
            placeholder="e.g. Newport Harbor Hotel, Newport RI"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={runOnEnter(run)}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={`${cls.input} min-w-0 flex-1`}
          />
          <button type="button" onClick={run} className={cls.btnSecondary} disabled={pending} aria-busy={pending}>
            {pending ? "Finding it on the map..." : "Check"}
          </button>
        </div>
      </div>
      <div aria-live="polite" className="space-y-2">
        {error ? (
          <p id={`${id}-error`} className={cls.fieldError}>
            {error}
          </p>
        ) : null}
        {verdict ? (
          <>
            <Chip tone={LOCATION_RESULT_TONE[verdict.result]}>{LOCATION_RESULT_LABEL[verdict.result]}</Chip>
            <VisitorMessage text={verdict.message || "No travel check runs (it is turned off), so the visitor sees no travel message."} />
            <p className="text-sm text-[var(--foreground)]">
              <span className="font-medium">Staff only:</span>{" "}
              {typeof verdict.miles === "number" ? `${verdict.miles.toFixed(1)} miles from home base` : "distance unknown"}
              {verdict.confidence ? `, map match ${verdict.confidence}` : ""}
              {verdict.query ? `, looked up "${verdict.query}"` : ""}.
            </p>
            {problem ? <Notice tone="warn">Staff only: {problem}</Notice> : null}
            <p className="text-xs text-[var(--muted)]">Checked {formatEasternTimestamp(verdict.checkedAt)}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
