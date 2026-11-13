"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearWorkIcalUrlAction,
  saveWorkIcalUrlAction,
} from "@/app/(app)/calendar/actions";

type WorkIcalSettingsFormProps = {
  configured: boolean;
};

export function WorkIcalSettingsForm({
  configured,
}: WorkIcalSettingsFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveWorkIcalUrlAction(url);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl("");
      setMessage("Team calendar URL saved.");
      router.refresh();
    });
  }

  function handleClear() {
    if (
      !confirm(
        "Dated projects will still show on the calendar.",
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await clearWorkIcalUrlAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl("");
      setMessage("Team calendar URL removed.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Team calendar (Google iCal)
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Open the shared team Google Calendar in{" "}
        <span className="font-medium">Google Calendar → Settings and sharing
        → Integrate calendar</span>{" "}
        and paste the{" "}
        <span className="font-medium">Secret address in iCal format</span>{" "}
        here — not the{" "}
        <code className="text-xs">@group.calendar.google.com</code> email. Stored
        server-side only. Dated projects from the Hub show next to this feed.
      </p>

      {configured ? (
        <p className="mt-3 rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--brand)]">
          A team calendar feed is configured. Paste a new URL below to
          replace it.
        </p>
      ) : null}

      <label className="mt-4 block space-y-1.5">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {configured ? "Replace iCal URL" : "iCal URL"}
        </span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/…"
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
        />
      </label>

      {error ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || !url.trim()}
          className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : configured ? "Update URL" : "Save URL"}
        </button>
        {configured ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleClear}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
    </form>
  );
}
