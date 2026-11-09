"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEventReportAction } from "@/app/(app)/end-of-event-report/actions";
import {
  EVENT_TYPES,
  type EventType,
} from "@/lib/types/event-reports";

type EventReportFormProps = {
  reporterName: string;
  reporterEmail: string;
};

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]";

export function EventReportForm({
  reporterName,
  reporterEmail,
}: EventReportFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [rating, setRating] = useState(5);
  const [eventType, setEventType] = useState<EventType>("Wedding");
  const [eventTypeOther, setEventTypeOther] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const form = event.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await createEventReportAction({
        event_date: String(data.get("event_date") ?? ""),
        client_name: String(data.get("client_name") ?? ""),
        venue: String(data.get("venue") ?? ""),
        event_type: eventType,
        event_type_other: eventTypeOther,
        equipment_notes: String(data.get("equipment_notes") ?? ""),
        memorable_moment: String(data.get("memorable_moment") ?? ""),
        issues: String(data.get("issues") ?? ""),
        client_feedback: String(data.get("client_feedback") ?? ""),
        rating,
        follow_up_needed: followUpNeeded,
        follow_up_notes: String(data.get("follow_up_notes") ?? ""),
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      form.reset();
      setFollowUpNeeded(false);
      setRating(5);
      setEventType("Wedding");
      setEventTypeOther("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
    >
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
          Report submitted. Thank you — your team can review it below.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-[var(--background)] px-3 py-2 text-sm">
        <span className="text-[var(--muted)]">Reporter · </span>
        <span className="font-medium text-[var(--foreground)]">
          {reporterName}
        </span>
        <span className="text-[var(--muted)]"> · {reporterEmail}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event date">
          <input
            name="event_date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </Field>
        <Field label="Event type">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className={inputClass}
            required
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {eventType === "Other" ? (
        <Field label="Describe this event type">
          <input
            value={eventTypeOther}
            onChange={(e) => setEventTypeOther(e.target.value)}
            required
            className={inputClass}
            placeholder="e.g. Quinceañera, Fundraiser, Private party"
          />
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name">
          <input
            name="client_name"
            required
            className={inputClass}
            placeholder="Client or couple name"
          />
        </Field>
        <Field label="Venue">
          <input
            name="venue"
            required
            className={inputClass}
            placeholder="Venue name"
          />
        </Field>
      </div>

      <Field label="Equipment notes">
        <textarea
          name="equipment_notes"
          rows={3}
          className={`${inputClass} min-h-20 py-2`}
          placeholder="What gear was used, anything missing or damaged…"
        />
      </Field>

      <Field label="Memorable moment">
        <textarea
          name="memorable_moment"
          rows={3}
          className={`${inputClass} min-h-20 py-2`}
          placeholder="A highlight worth sharing in social captions…"
        />
      </Field>

      <Field label="Issues">
        <textarea
          name="issues"
          rows={3}
          className={`${inputClass} min-h-20 py-2`}
          placeholder="Problems during the event (or leave blank)"
        />
      </Field>

      <Field label="Client feedback">
        <textarea
          name="client_feedback"
          rows={3}
          className={`${inputClass} min-h-20 py-2`}
          placeholder="Anything the client said or how they seemed…"
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--foreground)]">
          Overall rating
        </legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={[
                "inline-flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
                rating === value
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
              ].join(" ")}
              aria-pressed={rating === value}
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
        <input
          type="checkbox"
          checked={followUpNeeded}
          onChange={(e) => setFollowUpNeeded(e.target.checked)}
          className="h-4 w-4 accent-[var(--brand)]"
        />
        Follow-up needed by admin
      </label>

      {followUpNeeded && (
        <Field label="Notes for admin follow-up">
          <textarea
            name="follow_up_notes"
            rows={3}
            required={followUpNeeded}
            className={`${inputClass} min-h-20 py-2`}
            placeholder="What should an admin follow up on?"
          />
        </Field>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[var(--foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}
