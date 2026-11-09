"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { rotateFeedTokenAction } from "@/app/(app)/my-calendar/actions";

export function MyCalendarClient({
  origin,
  token,
}: {
  origin: string;
  token: string | null;
}) {
  const [currentToken, setCurrentToken] = useState(token);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  if (!currentToken) {
    return (
      <p className="mt-4 text-sm text-[var(--muted)]">
        Your calendar link isn&apos;t available yet. Ask an admin to check that
        the calendar feed migration has run.
      </p>
    );
  }

  const feedUrl = `${origin}/api/calendar/feed/${currentToken}.ics`;
  const webcalUrl = feedUrl.replace(/^https?:/i, "webcal:");

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  async function rotate() {
    if (rotating) return;
    if (
      !window.confirm(
        "Generate a new link? Any calendar already subscribed with the old link will stop updating and must re-subscribe.",
      )
    ) {
      return;
    }
    setRotating(true);
    try {
      const res = await rotateFeedTokenAction();
      if (res.token) setCurrentToken(res.token);
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Your private calendar link
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            readOnly
            value={feedUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)]"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={webcalUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
        >
          Add to Apple Calendar
        </a>
        <a
          href="https://calendar.google.com/calendar/r/settings/addbyurl"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
        >
          Add to Google Calendar
        </a>
        <button
          type="button"
          onClick={rotate}
          disabled={rotating}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} />
          {rotating ? "Rotating…" : "Reset link"}
        </button>
      </div>

      <div className="space-y-3 text-sm text-[var(--foreground)]">
        <div>
          <div className="font-semibold">Apple Calendar</div>
          <p className="text-[var(--muted)]">
            Tap “Add to Apple Calendar” above, or in the Calendar app choose File
            → New Calendar Subscription and paste the link. You can set how often
            it refreshes (as often as every 15 minutes).
          </p>
        </div>
        <div>
          <div className="font-semibold">Google Calendar</div>
          <p className="text-[var(--muted)]">
            Copy the link, then in Google Calendar open Other calendars → From URL
            and paste it. Google refreshes subscribed calendars on its own
            schedule (often several hours), so it isn&apos;t instant.
          </p>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        This link is private to you and read-only. If it&apos;s ever shared or
        you lose a device, use “Reset link” to revoke it and get a new one.
      </p>
    </div>
  );
}
