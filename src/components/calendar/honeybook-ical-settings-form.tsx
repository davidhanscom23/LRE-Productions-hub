"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearHoneybookIcalUrlAction,
  saveHoneybookIcalUrlAction,
} from "@/app/(app)/calendar/actions";

type HoneybookIcalSettingsFormProps = {
  configured: boolean;
};

export function HoneybookIcalSettingsForm({
  configured,
}: HoneybookIcalSettingsFormProps) {
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
      const result = await saveHoneybookIcalUrlAction(url);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl("");
      setMessage("HoneyBook calendar URL saved.");
      router.refresh();
    });
  }

  function handleClear() {
    if (
      !confirm(
        "CRM project dates can still show if synced via Zapier/CSV.",
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await clearHoneybookIcalUrlAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl("");
      setMessage("HoneyBook calendar URL removed.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        HoneyBook calendar (Google iCal)
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        If HoneyBook syncs to a Google Calendar (the one shared to Apple), open
        that calendar in{" "}
        <span className="font-medium">Google Calendar → Settings and sharing
        → Integrate calendar</span>{" "}
        and paste the{" "}
        <span className="font-medium">Secret address in iCal format</span>{" "}
        here — not the{" "}
        <code className="text-xs">@group.calendar.google.com</code> email. Stored
        server-side only. The Hub merges this live feed with HoneyBook CRM data
        from Zapier/CSV (stage, client, project type) so event cards stay
        complete — CRM stage is used as the status, not the Google iCal status.
      </p>

      {configured ? (
        <p className="mt-3 rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--brand)]">
          A HoneyBook calendar feed is configured. Paste a new URL below to
          replace it.
        </p>
      ) : null}

      <label className="mt-4 block space-y-1.5">
        <span className="text-sm font-medium text-[var(--foreground)]">
          {configured ? "Replace HoneyBook iCal URL" : "HoneyBook iCal URL"}
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
