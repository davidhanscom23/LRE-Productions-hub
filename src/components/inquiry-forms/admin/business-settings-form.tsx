"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, MapPinned, Plus, Trash2 } from "lucide-react";
import { geocodeAddress, saveBusinessSettings } from "@/app/(app)/inquiry-forms/actions";
import type { BusinessSettings } from "@/lib/inquiry-forms/types";
import { cls, Notice, PageHeader } from "./list-ui";
import { OPAQUE_SURFACE_STYLE } from "./builder-ui";
import {
  FieldShell,
  MessageField,
  NumberField,
  RadioCards,
  SettingsCard,
  TextField,
  Toggle,
} from "./settings-fields";
import { SettingsTestTools } from "./settings-test-tools";
import {
  ABANDON_DELAY_CHOICES,
  issuesByPath,
  validateBusinessSettings,
  type SettingsIssue,
} from "./settings-validate";

export interface BusinessSettingsFormProps {
  initial: BusinessSettings;
  /** Hub departments whose people can count as capacity. */
  departments: readonly string[];
  /** Both Turnstile env keys exist on the server. */
  turnstileAvailable: boolean;
  /** GOOGLE_MAPS_API_KEY exists (driving miles instead of straight line x road factor). */
  googleMapsAvailable: boolean;
}

type GeoState =
  | { state: "idle" }
  | { state: "ok"; display: string; confidence: string }
  | { state: "error"; message: string };

const DELAY_LABEL: Record<number, string> = {
  5: "5 minutes",
  10: "10 minutes",
  15: "15 minutes",
  20: "20 minutes",
  30: "30 minutes",
  60: "1 hour",
};

/** Business settings for every form: home base, travel zones, availability, alerts, spam, emoji. */
export function BusinessSettingsForm({
  initial,
  departments,
  turnstileAvailable,
  googleMapsAvailable,
}: BusinessSettingsFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [settings, setSettings] = useState<BusinessSettings>(initial);
  const [saved, setSaved] = useState<BusinessSettings>(initial);
  const [numberKey, setNumberKey] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Record<string, string>>({});
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>({ state: "idle" });
  const [saving, startSave] = useTransition();
  const [locating, startLocate] = useTransition();
  const departmentsId = useId();
  const delayId = useId();
  const emojiId = useId();

  const validation = useMemo(
    () => validateBusinessSettings(settings, { departments, turnstileAvailable }),
    [settings, departments, turnstileAvailable],
  );
  const errors: Record<string, string> = {
    ...serverIssues,
    ...(showErrors && !validation.ok ? issuesByPath(validation.issues) : {}),
  };
  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function patch(fn: (draft: BusinessSettings) => void) {
    setSettings((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setSavedNote(null);
    setServerIssues({});
    setServerError(null);
  }

  function focusFirstError() {
    window.requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.focus();
      el?.scrollIntoView({ block: "center" });
    });
  }

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving) return;
    setShowErrors(true);
    setSavedNote(null);
    setServerError(null);
    if (!validation.ok) {
      focusFirstError();
      return;
    }
    const value = validation.value;
    startSave(async () => {
      try {
        const res = await saveBusinessSettings(value);
        if (!res.ok) {
          setServerError(res.error);
          const issues = (res as { issues?: SettingsIssue[] }).issues;
          setServerIssues(issues ? issuesByPath(issues) : {});
          focusFirstError();
          return;
        }
        setSettings(value);
        setSaved(value);
        setNumberKey((k) => k + 1);
        setShowErrors(false);
        setSavedNote("Saved. Every form uses these settings from the next visitor on.");
      } catch {
        setServerError("Could not reach the Hub. Check your connection and try again.");
      }
    });
  }

  function undo() {
    setSettings(saved);
    setNumberKey((k) => k + 1);
    setShowErrors(false);
    setServerIssues({});
    setServerError(null);
    setSavedNote(null);
    setGeo({ state: "idle" });
  }

  function findOnMap() {
    const address = settings.homeBase.address.trim();
    if (!address) {
      setGeo({ state: "error", message: "Type the home base address first." });
      return;
    }
    setGeo({ state: "idle" });
    startLocate(async () => {
      try {
        const res = await geocodeAddress(address);
        if (!res.ok) {
          setGeo({ state: "error", message: res.error });
          return;
        }
        patch((d) => {
          d.homeBase.lat = res.lat;
          d.homeBase.lng = res.lng;
        });
        setNumberKey((k) => k + 1);
        setGeo({ state: "ok", display: res.display, confidence: res.confidence });
      } catch {
        setGeo({ state: "error", message: "Could not reach the Hub. Check your connection and try again." });
      }
    });
  }

  const s = settings;
  const hasCoords = typeof s.homeBase.lat === "number" && typeof s.homeBase.lng === "number";
  const hardLimit = s.location.zones.maxMiles !== null;
  const capacity = s.availability.capacity;
  const selectedDepartments = capacity.departments ?? [];
  const errorCount = Object.keys(errors).length;

  return (
    <div className="mx-auto max-w-4xl pb-6">
      <PageHeader
        title="Inquiry Forms: business settings"
        description="These apply to every form: where you are based, how far you travel, how dates are checked, alerts and spam limits."
        actions={
          <Link href="/inquiry-forms" className={cls.btnSecondary}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All forms
          </Link>
        }
      />

      <form ref={formRef} onSubmit={save} noValidate className="space-y-5">
        {showErrors && errorCount > 0 ? (
          <Notice tone="bad" title={`Fix ${errorCount === 1 ? "1 thing" : `${errorCount} things`} before saving`}>
            Each problem is marked in red next to its field.
          </Notice>
        ) : null}
        {serverError ? <Notice tone="bad" title="Not saved">{serverError}</Notice> : null}

        <SettingsCard
          title="Home base"
          description="Where your team leaves from. Travel distances are measured from here."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              help="For staff only, e.g. Warehouse or Main office."
              value={s.homeBase.label}
              maxLength={120}
              error={errors["homeBase.label"]}
              onChange={(v) => patch((d) => void (d.homeBase.label = v))}
            />
            <TextField
              label="Address"
              help="Street, city, state and ZIP."
              value={s.homeBase.address}
              maxLength={300}
              autoComplete="street-address"
              error={errors["homeBase.address"]}
              onChange={(v) => patch((d) => void (d.homeBase.address = v))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={cls.btnSecondary} onClick={findOnMap} disabled={locating} aria-busy={locating}>
              <MapPinned className="h-4 w-4" aria-hidden="true" />
              {locating ? "Looking up the address..." : "Find on map"}
            </button>
            <span aria-live="polite" className="text-sm">
              {geo.state === "ok" ? (
                <span className="text-[var(--foreground)]">
                  Found: {geo.display} (match {geo.confidence}). Check the pin, then save.
                </span>
              ) : geo.state === "error" ? (
                <span className="font-medium text-red-700 dark:text-red-300">{geo.message}</span>
              ) : null}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              key={`lat-${numberKey}`}
              label="Latitude"
              decimal
              defaultValue={s.homeBase.lat}
              placeholder="30.24"
              error={errors["homeBase.lat"]}
              onValue={(n) => patch((d) => void (d.homeBase.lat = n))}
            />
            <NumberField
              key={`lng-${numberKey}`}
              label="Longitude"
              decimal
              defaultValue={s.homeBase.lng}
              placeholder="-81.3853"
              error={errors["homeBase.lng"]}
              onValue={(n) => patch((d) => void (d.homeBase.lng = n))}
            />
            <div className="flex items-end">
              {hasCoords ? (
                <a
                  className={cls.btnSecondary}
                  href={`https://www.openstreetmap.org/?mlat=${s.homeBase.lat}&mlon=${s.homeBase.lng}#map=13/${s.homeBase.lat}/${s.homeBase.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View the pin<span className="sr-only"> (opens a map in a new tab)</span>
                </a>
              ) : (
                <p className="text-sm text-[var(--muted)]">No pin yet: use Find on map or type the numbers.</p>
              )}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Travel area"
          description={
            googleMapsAvailable
              ? "Distances are driving miles from Google Maps."
              : "Distances are straight-line miles times the road factor below (no Google Maps key is set)."
          }
        >
          <Toggle
            label="Check the venue's distance"
            help="When on, the checking step tells visitors whether their venue is in your area. Forms whose checking step includes the location use this."
            checked={s.location.enabled}
            error={errors["location.enabled"]}
            onChange={(v) => patch((d) => void (d.location.enabled = v))}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              key={`pass-${numberKey}`}
              label="No travel fee up to"
              suffix="miles"
              decimal
              defaultValue={s.location.zones.passMiles}
              error={errors["location.zones.passMiles"]}
              onValue={(n) => patch((d) => void (d.location.zones.passMiles = n as number))}
            />
            <NumberField
              key={`risky-${numberKey}`}
              label="Travel fee up to"
              suffix="miles"
              decimal
              defaultValue={s.location.zones.riskyMiles}
              error={errors["location.zones.riskyMiles"]}
              onValue={(n) => patch((d) => void (d.location.zones.riskyMiles = n as number))}
            />
            <NumberField
              key={`talk-${numberKey}`}
              label="Talk it through up to"
              suffix="miles"
              decimal
              defaultValue={s.location.zones.talkMiles}
              error={errors["location.zones.talkMiles"]}
              onValue={(n) =>
                patch((d) => {
                  d.location.zones.talkMiles = n as number;
                  if (d.location.zones.maxMiles !== null) d.location.zones.maxMiles = n;
                })
              }
            />
          </div>
          <RadioCards<"none" | "limit">
            legend="Farther than that"
            value={hardLimit ? "limit" : "none"}
            error={errors["location.zones.maxMiles"]}
            options={[
              {
                value: "none",
                label: "Keep talking",
                description: "No hard limit: farther venues also get the talk-it-through message.",
              },
              {
                value: "limit",
                label: "Too far",
                description: "Past the talk-it-through distance, visitors get the outside-the-area message.",
              },
            ]}
            onChange={(v) =>
              patch((d) => {
                d.location.zones.maxMiles = v === "limit" ? d.location.zones.talkMiles : null;
              })
            }
          />
          <NumberField
            key={`road-${numberKey}`}
            label="Road factor"
            help="Straight-line miles are multiplied by this to estimate driving miles. 1.2 is typical."
            decimal
            defaultValue={s.location.roadFactor}
            error={errors["location.roadFactor"]}
            onValue={(n) => patch((d) => void (d.location.roadFactor = n as number))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <MessageField
              label="Message: no travel fee zone"
              value={s.location.messages.pass}
              error={errors["location.messages.pass"]}
              onChange={(v) => patch((d) => void (d.location.messages.pass = v))}
            />
            <MessageField
              label="Message: travel fee zone"
              value={s.location.messages.risky}
              error={errors["location.messages.risky"]}
              onChange={(v) => patch((d) => void (d.location.messages.risky = v))}
            />
            <MessageField
              label="Message: talk it through"
              help={hardLimit ? undefined : "Also shown for venues farther than that, since there is no hard limit."}
              value={s.location.messages.talk}
              error={errors["location.messages.talk"]}
              onChange={(v) => patch((d) => void (d.location.messages.talk = v))}
            />
            <MessageField
              label="Message: outside the area"
              help={hardLimit ? undefined : "Only used when Too far is chosen above."}
              value={s.location.messages.fail}
              error={errors["location.messages.fail"]}
              onChange={(v) => patch((d) => void (d.location.messages.fail = v))}
            />
            <MessageField
              label="Message: address not found"
              help="When the venue cannot be found on the map, or the match is too rough to judge."
              value={s.location.messages.unverified}
              error={errors["location.messages.unverified"]}
              onChange={(v) => patch((d) => void (d.location.messages.unverified = v))}
            />
          </div>
        </SettingsCard>

        <SettingsCard
          title="Date availability"
          description="How the checking step answers 'is my date open?'. Visitors never see how many events you have or who is working."
        >
          <RadioCards<BusinessSettings["availability"]["mode"]>
            legend="How dates are checked"
            value={s.availability.mode}
            error={errors["availability.mode"]}
            options={[
              {
                value: "bookings",
                label: "Check our bookings",
                description: "Compares booked events on that day with how many you can take.",
              },
              {
                value: "open",
                label: "Always open",
                description: "Never blocks a date; visitors get the soft 'looks open' message.",
              },
              { value: "off", label: "Off", description: "No date check. The checking step skips the date." },
            ]}
            onChange={(v) => patch((d) => void (d.availability.mode = v))}
          />

          {s.availability.mode === "bookings" ? (
            <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
              <RadioCards<BusinessSettings["availability"]["capacity"]["source"]>
                legend="How many events you can take on one day"
                value={capacity.source}
                error={errors["availability.capacity.source"]}
                options={[
                  {
                    value: "staff",
                    label: "Count our people",
                    description: "Active people in the departments below, minus approved time off that day.",
                  },
                  { value: "fixed", label: "A fixed number", description: "The same limit every day." },
                  {
                    value: "none",
                    label: "Do not count",
                    description: "Every date gets the 'we will confirm' message.",
                  },
                ]}
                onChange={(v) => patch((d) => void (d.availability.capacity.source = v))}
              />
              {capacity.source === "staff" ? (
                <fieldset aria-describedby={errors["availability.capacity.departments"] ? `${departmentsId}-error` : undefined}>
                  <legend className={cls.label}>Departments that count</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {departments.map((dep) => {
                      const checked = selectedDepartments.includes(dep);
                      const id = `${departmentsId}-${dep.replace(/\W+/g, "-")}`;
                      return (
                        <label
                          key={dep}
                          htmlFor={id}
                          className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm text-[var(--foreground)] ${
                            checked ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)] bg-[var(--surface)]"
                          }`}
                        >
                          <input
                            id={id}
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              patch((d) => {
                                const list = new Set(d.availability.capacity.departments ?? []);
                                if (e.target.checked) list.add(dep);
                                else list.delete(dep);
                                d.availability.capacity.departments = departments.filter((x) => list.has(x));
                              })
                            }
                            className="h-4 w-4 accent-[var(--brand)]"
                          />
                          {dep}
                        </label>
                      );
                    })}
                  </div>
                  {errors["availability.capacity.departments"] ? (
                    <p id={`${departmentsId}-error`} className={cls.fieldError}>
                      {errors["availability.capacity.departments"]}
                    </p>
                  ) : null}
                </fieldset>
              ) : null}
              {capacity.source === "fixed" ? (
                <NumberField
                  key={`fixed-${numberKey}`}
                  label="Events per day"
                  defaultValue={capacity.fixed ?? null}
                  error={errors["availability.capacity.fixed"]}
                  onValue={(n) => patch((d) => void (d.availability.capacity.fixed = n))}
                />
              ) : null}
              <p className="text-sm text-[var(--muted)]">
                A day is full when its booked events reach that number, and almost full one event before (when the
                number is 2 or more). Dates more than about 18 months out get the &quot;we will confirm&quot; message.
              </p>
            </div>
          ) : null}

          <BlackoutEditor
            blackouts={s.availability.blackouts}
            errors={errors}
            onChange={(list) => patch((d) => void (d.availability.blackouts = list))}
          />

          <NumberField
            key={`notice-${numberKey}`}
            label="Minimum notice"
            help="Dates sooner than this many days from today get the 'too soon' message. Leave empty for none."
            suffix="days"
            defaultValue={s.availability.minNoticeDays}
            error={errors["availability.minNoticeDays"]}
            onValue={(n) => patch((d) => void (d.availability.minNoticeDays = n))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <MessageField
              label="Message: date is open"
              value={s.availability.messages.available}
              error={errors["availability.messages.available"]}
              onChange={(v) => patch((d) => void (d.availability.messages.available = v))}
            />
            <MessageField
              label="Message: almost full"
              value={s.availability.messages.limited}
              error={errors["availability.messages.limited"]}
              onChange={(v) => patch((d) => void (d.availability.messages.limited = v))}
            />
            <MessageField
              label="Message: fully booked"
              value={s.availability.messages.unavailable}
              error={errors["availability.messages.unavailable"]}
              onChange={(v) => patch((d) => void (d.availability.messages.unavailable = v))}
            />
            <MessageField
              label="Message: we will confirm"
              help="When the date cannot be judged (too far ahead, no capacity count, or a lookup problem)."
              value={s.availability.messages.unknown}
              error={errors["availability.messages.unknown"]}
              onChange={(v) => patch((d) => void (d.availability.messages.unknown = v))}
            />
            <MessageField
              label="Message: always open mode"
              value={s.availability.messages.open}
              error={errors["availability.messages.open"]}
              onChange={(v) => patch((d) => void (d.availability.messages.open = v))}
            />
            <MessageField
              label="Message: too soon"
              help="Past dates and dates inside the minimum notice."
              value={s.availability.messages.tooSoon}
              error={errors["availability.messages.tooSoon"]}
              onChange={(v) => patch((d) => void (d.availability.messages.tooSoon = v))}
            />
            <MessageField
              label="Message: blackout date"
              value={s.availability.messages.blackout}
              error={errors["availability.messages.blackout"]}
              onChange={(v) => patch((d) => void (d.availability.messages.blackout = v))}
            />
          </div>
        </SettingsCard>

        <SettingsCard
          title="Unfinished inquiries"
          description="When someone gives an email or phone and then stops partway, the admins can get an alert in the Hub."
        >
          <Toggle
            label="Alert the admins about unfinished inquiries"
            checked={s.abandonment.alertStaff}
            onChange={(v) => patch((d) => void (d.abandonment.alertStaff = v))}
          />
          <FieldShell
            id={delayId}
            label="Alert after"
            help="How long the visitor has to be inactive before the alert goes out."
            error={errors["abandonment.delayMinutes"]}
          >
            <select
              id={delayId}
              value={String(s.abandonment.delayMinutes)}
              disabled={!s.abandonment.alertStaff}
              onChange={(e) => patch((d) => void (d.abandonment.delayMinutes = Number(e.target.value)))}
              aria-invalid={errors["abandonment.delayMinutes"] ? true : undefined}
              aria-describedby={`${delayId}-help${errors["abandonment.delayMinutes"] ? ` ${delayId}-error` : ""}`}
              className={`${cls.select} max-w-[12rem]`}
            >
              {Array.from(new Set<number>([...ABANDON_DELAY_CHOICES, s.abandonment.delayMinutes]))
                .filter((m) => Number.isFinite(m))
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {DELAY_LABEL[m] ?? `${m} minutes`}
                  </option>
                ))}
            </select>
          </FieldShell>
        </SettingsCard>

        <SettingsCard
          title="Spam protection"
          description="Bots still see a normal thank-you, but their inquiries are stored as spam and nobody is alerted."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              key={`starts-${numberKey}`}
              label="New forms per visitor per hour"
              help="More than this from one connection in an hour counts as spam."
              defaultValue={s.spam.maxStartsPerIpPerHour}
              error={errors["spam.maxStartsPerIpPerHour"]}
              onValue={(n) => patch((d) => void (d.spam.maxStartsPerIpPerHour = n as number))}
            />
            <NumberField
              key={`completes-${numberKey}`}
              label="Inquiries per email per day"
              help="More than this from one email address in a day counts as spam."
              defaultValue={s.spam.maxCompletesPerEmailPerDay}
              error={errors["spam.maxCompletesPerEmailPerDay"]}
              onValue={(n) => patch((d) => void (d.spam.maxCompletesPerEmailPerDay = n as number))}
            />
          </div>
          <Toggle
            label="Cloudflare Turnstile bot check"
            help={
              turnstileAvailable
                ? "Adds an invisible bot check to every form."
                : "Not available yet: add TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY in Vercel, redeploy, then turn it on here."
            }
            checked={s.spam.turnstile && turnstileAvailable}
            disabled={!turnstileAvailable}
            error={errors["spam.turnstile"]}
            onChange={(v) => patch((d) => void (d.spam.turnstile = v))}
          />
        </SettingsCard>

        <SettingsCard
          title="Email subject emoji"
          description="An optional emoji at the start of emails sent to the visitor. Only used by forms with the confirmation email turned on."
        >
          <FieldShell id={emojiId} label="Emoji prefix" help="For example a party popper. Leave empty for none." error={errors.emojiPrefix}>
            <input
              id={emojiId}
              type="text"
              value={s.emojiPrefix ?? ""}
              maxLength={16}
              autoComplete="off"
              onChange={(e) => patch((d) => void (d.emojiPrefix = e.target.value ? e.target.value : null))}
              aria-invalid={errors.emojiPrefix ? true : undefined}
              aria-describedby={`${emojiId}-help${errors.emojiPrefix ? ` ${emojiId}-error` : ""}`}
              className={`${cls.input} max-w-[8rem]`}
            />
          </FieldShell>
        </SettingsCard>

        <SettingsCard
          title="Try it"
          description="See exactly what a visitor would read for a date or a venue, with the saved settings."
        >
          <SettingsTestTools dirty={dirty} />
        </SettingsCard>

        <div
          className="sticky bottom-0 z-20 -mx-1 rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[0_-6px_18px_rgba(0,0,0,0.08)]"
          style={OPAQUE_SURFACE_STYLE}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--foreground)]" aria-live="polite">
              {saving ? "Saving..." : savedNote ? savedNote : dirty ? "You have unsaved changes." : "All changes saved."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={cls.btnSecondary} onClick={undo} disabled={!dirty || saving}>
                Undo changes
              </button>
              <button type="submit" className={cls.btnPrimary} disabled={saving || !dirty} aria-busy={saving}>
                {saving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function BlackoutEditor({
  blackouts,
  errors,
  onChange,
}: {
  blackouts: BusinessSettings["availability"]["blackouts"];
  errors: Record<string, string>;
  onChange: (list: BusinessSettings["availability"]["blackouts"]) => void;
}) {
  const baseId = useId();
  const update = (i: number, key: "start" | "end" | "label", value: string) => {
    const next = blackouts.map((b, j) => (j === i ? { ...b, [key]: value } : b));
    onChange(next);
  };
  return (
    <fieldset className="space-y-3">
      <legend className={cls.label}>Blackout dates</legend>
      <p className="text-xs text-[var(--muted)]">
        Days you never take events (vacations, holidays). Visitors get the blackout message. One day: use the same
        start and end date.
      </p>
      {errors["availability.blackouts"] ? <p className={cls.fieldError}>{errors["availability.blackouts"]}</p> : null}
      {blackouts.length === 0 ? <p className="text-sm text-[var(--muted)]">No blackout dates.</p> : null}
      <ul className="space-y-3">
        {blackouts.map((b, i) => {
          const startId = `${baseId}-${i}-start`;
          const endId = `${baseId}-${i}-end`;
          const labelId = `${baseId}-${i}-label`;
          const eStart = errors[`availability.blackouts.${i}.start`];
          const eEnd = errors[`availability.blackouts.${i}.end`];
          const eLabel = errors[`availability.blackouts.${i}.label`];
          return (
            <li key={i} className="grid gap-3 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[10rem_10rem_1fr_auto] sm:items-start">
              <div>
                <label htmlFor={startId} className="text-xs font-medium text-[var(--foreground)]">
                  From
                </label>
                <input
                  id={startId}
                  type="date"
                  value={b.start}
                  onChange={(e) => update(i, "start", e.target.value)}
                  aria-invalid={eStart ? true : undefined}
                  aria-describedby={eStart ? `${startId}-error` : undefined}
                  className={`${cls.input} mt-1 ${eStart ? cls.inputInvalid : ""}`}
                />
                {eStart ? <p id={`${startId}-error`} className={cls.fieldError}>{eStart}</p> : null}
              </div>
              <div>
                <label htmlFor={endId} className="text-xs font-medium text-[var(--foreground)]">
                  To
                </label>
                <input
                  id={endId}
                  type="date"
                  value={b.end}
                  min={b.start || undefined}
                  onChange={(e) => update(i, "end", e.target.value)}
                  aria-invalid={eEnd ? true : undefined}
                  aria-describedby={eEnd ? `${endId}-error` : undefined}
                  className={`${cls.input} mt-1 ${eEnd ? cls.inputInvalid : ""}`}
                />
                {eEnd ? <p id={`${endId}-error`} className={cls.fieldError}>{eEnd}</p> : null}
              </div>
              <div>
                <label htmlFor={labelId} className="text-xs font-medium text-[var(--foreground)]">
                  Note (staff only)
                </label>
                <input
                  id={labelId}
                  type="text"
                  value={b.label ?? ""}
                  maxLength={80}
                  placeholder="e.g. Family vacation"
                  onChange={(e) => update(i, "label", e.target.value)}
                  aria-invalid={eLabel ? true : undefined}
                  aria-describedby={eLabel ? `${labelId}-error` : undefined}
                  className={`${cls.input} mt-1 ${eLabel ? cls.inputInvalid : ""}`}
                />
                {eLabel ? <p id={`${labelId}-error`} className={cls.fieldError}>{eLabel}</p> : null}
              </div>
              <div className="sm:pt-5">
                <button
                  type="button"
                  className={cls.btnDangerSmall}
                  onClick={() => onChange(blackouts.filter((_, j) => j !== i))}
                  aria-label={`Remove blackout ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={cls.btnSecondary}
        onClick={() => onChange([...blackouts, { start: "", end: "" }])}
        disabled={blackouts.length >= 200}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add blackout dates
      </button>
    </fieldset>
  );
}

export default BusinessSettingsForm;
