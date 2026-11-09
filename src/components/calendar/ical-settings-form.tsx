"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearCompanyIcalUrlAction,
  saveCompanyIcalUrlAction,
} from "@/app/(app)/calendar/actions";

type IcalSettingsFormProps = {
  configured: boolean;
};

export function IcalSettingsForm({ configured }: IcalSettingsFormProps) {
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
      const result = await saveCompanyIcalUrlAction(url);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl("");
      setMessage("Company calendar URL saved.");
      router.refresh();
    });
  }

  function handleClear() {
    if (!confirm("Remove the company iCal URL? The calendar will go empty until you add it again.")) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await clearCompanyIcalUrlAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setUrl("");
      setMessage("Company calendar URL removed.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-[var(--foreground)]">
        Company iCal feed
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Paste a company-wide dynamic iCal URL from your scheduling system.
        It’s stored server-side only and never shown in the browser after
        saving. Include client contact details and time-off entries in the feed
        if you want them to appear on Calendar cards and Staffing — Staffing
        merges feed absences with approved Hub requests so each person appears
        once; day-off rows stay off the Calendar.
      </p>

      {configured ? (
        <p className="mt-3 rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--brand)]">
          A company feed is configured. Paste a new URL below to replace it.
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
          placeholder="https://…"
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
