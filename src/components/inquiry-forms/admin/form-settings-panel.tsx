"use client";

/**
 * Inquiry Forms - Settings tab: every per-form setting, plus the form name and web address.
 * All edits go through the editor's history (undo / redo) and are saved with Save draft.
 */
import { useId } from "react";
import { AlertTriangle, Wand2 } from "lucide-react";
import { DATE_LOADING_MESSAGES, LOCATION_LOADING_MESSAGES, URGENCY_PRESETS } from "@/lib/inquiry-forms/defaults";
import { isValidSlug, slugFromName } from "@/lib/inquiry-forms/slug";
import { findRoleField } from "@/lib/inquiry-forms/definition";
import type { BrandProfile, FormSettings, GhlCopySettings } from "@/lib/inquiry-forms/types";
import { safeRedirectUrl } from "@/lib/inquiry-forms/embed-protocol";
import { HUB_COPY } from "@/lib/inquiry-forms/hub-copy";
import { TIMING_RANGES, type EditorIssue, type SettingsSection } from "./builder-checks";
import type { EditorDraft } from "./builder-ops";
import {
  Callout,
  LinesField,
  NumberField,
  PanelSection,
  SegmentedField,
  SelectField,
  TextField,
  ToggleField,
  btn,
  inputClass,
} from "./builder-ui";
import { MIN_TEXT_CONTRAST, darkenForWhiteText, isHexColor, normalizeHex, whiteTextContrast } from "./form-settings-contrast";
import { DateActionsEditor, RecipientsEditor, ReferralLinksEditor } from "./form-settings-lists";

export const SETTINGS_SECTIONS: ReadonlyArray<{ id: SettingsSection; label: string }> = [
  { id: "basics", label: "Name and address" },
  { id: "brand", label: "Brand and color" },
  { id: "copy", label: "Page text" },
  { id: "thanks", label: "After sending" },
  { id: "qualify", label: "Availability reveal" },
  { id: "date", label: "Date is taken" },
  { id: "location", label: "Outside your area" },
  { id: "emails", label: "Emails and alerts" },
  { id: "owners", label: "Who owns each type" },
  { id: "copies", label: "Copies to other systems" },
  { id: "embed", label: "Website embed" },
  { id: "progress", label: "Progress labels" },
];

export function settingsSectionId(section: SettingsSection): string {
  return `form-settings-${section}`;
}

export interface FormSettingsPanelProps {
  draft: EditorDraft;
  edit: (updater: (d: EditorDraft) => EditorDraft, coalesceKey?: string) => void;
  breakCoalesce: () => void;
  brands: BrandProfile[];
  publicOrigin: string;
  savedSlug: string;
  /** Published forms keep their address (saveDraft refuses a new slug). */
  slugLocked: boolean;
  issues: EditorIssue[];
}

type SettingsUpdater = (s: FormSettings) => FormSettings;

const EMPTY_GHL: GhlCopySettings = {
  enabled: false,
  locationId: "",
  trackingId: "",
  formId: "",
  siteUrl: "",
  notesKey: "contact.event_details",
  notesLabel: "Event Details",
  eventTypeKey: null,
  servicesKey: null,
};

function hostOf(origin: string): string {
  return origin.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function FormSettingsPanel({
  draft,
  edit,
  breakCoalesce,
  brands,
  publicOrigin,
  savedSlug,
  slugLocked,
  issues,
}: FormSettingsPanelProps) {
  const s = draft.settings;
  const urgencyGroup = useId();
  const setSettings = (fn: SettingsUpdater, key?: string) => edit((d) => ({ ...d, settings: fn(d.settings) }), key);
  const k = (name: string) => `settings:${name}`;
  const onBlur = breakCoalesce;

  const errorSections = new Set(
    issues.filter((i) => i.severity === "error" && i.target?.tab === "settings").map((i) => (i.target as { section: SettingsSection }).section),
  );
  const issueList = (section: SettingsSection) =>
    issues
      .filter((i) => i.target?.tab === "settings" && i.target.section === section)
      .map((issue) => (
        <Callout key={issue.id} tone={issue.severity === "error" ? "error" : "warning"}>
          {issue.message}
        </Callout>
      ));

  // Brand + accent
  const currentBrand = brands.find((b) => b.key === s.brand) ?? null;
  const accentValid = isHexColor(s.accentColor);
  const contrast = accentValid ? whiteTextContrast(s.accentColor) : null;
  const darker = accentValid && contrast !== null && contrast < MIN_TEXT_CONTRAST ? darkenForWhiteText(s.accentColor) : null;

  // Urgency
  const presetIndex = s.qualify.urgency === null ? -1 : URGENCY_PRESETS.indexOf(s.qualify.urgency);
  const urgencyMode: "none" | "preset" | "custom" =
    s.qualify.urgency === null ? "none" : presetIndex >= 0 ? "preset" : "custom";

  // Owners by event type + copies
  const eventTypeField = findRoleField(draft.definition, "event_type");
  const eventTypeChoices = eventTypeField?.choices ?? [];
  const owners = s.ownerByEventType ?? {};
  const setOwner = (choice: string, email: string) =>
    setSettings((prev) => {
      const next = { ...(prev.ownerByEventType ?? {}) };
      if (email.trim()) next[choice] = email.trim();
      else delete next[choice];
      return { ...prev, ownerByEventType: next };
    }, k(`owner:${choice}`));
  const ghl = s.copies?.ghl ?? null;
  const setGhl = (patch: Partial<GhlCopySettings>, key?: string) =>
    setSettings(
      (prev) => ({ ...prev, copies: { ...prev.copies, ghl: { ...(prev.copies?.ghl ?? EMPTY_GHL), ...patch } } }),
      key ? k(key) : undefined,
    );

  const slugChanged = draft.slug !== savedSlug;
  const host = hostOf(publicOrigin);
  const redirectBad = Boolean(s.redirectUrl && s.redirectUrl.trim() && !safeRedirectUrl(s.redirectUrl.trim()));

  const timing = (
    key: keyof FormSettings["qualify"]["timings"],
    label: string,
    hint: string,
  ) => {
    const range = TIMING_RANGES[key];
    const ms = s.qualify.timings[key];
    const out = ms < range.min || ms > range.max;
    return (
      <NumberField
        label={label}
        allowDecimal
        unit="sec"
        value={Math.round(ms) / 1000}
        onChange={(sec) =>
          setSettings(
            (prev) => ({
              ...prev,
              qualify: {
                ...prev.qualify,
                timings: { ...prev.qualify.timings, [key]: Math.round((sec ?? 0) * 1000) },
              },
            }),
            k(`timing:${key}`),
          )
        }
        onBlur={onBlur}
        error={out ? `Use ${range.min / 1000} to ${range.max / 1000} seconds.` : null}
        hint={hint}
      />
    );
  };

  return (
    <div className="grid gap-4 @4xl:grid-cols-[13rem_minmax(0,1fr)]" data-history-scope>
      <nav aria-label="Settings sections" className="@4xl:sticky @4xl:top-28 @4xl:self-start">
        <ul className="flex flex-wrap gap-1.5 @4xl:flex-col @4xl:gap-0.5">
          {SETTINGS_SECTIONS.map((sec) => (
            <li key={sec.id}>
              <button
                type="button"
                onClick={() =>
                  document.getElementById(settingsSectionId(sec.id))?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] @4xl:border-transparent @4xl:bg-transparent"
              >
                <span className="truncate">{sec.label}</span>
                {errorSections.has(sec.id) ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Has a problem" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-4">
        {/* Name and web address */}
        <PanelSection id={settingsSectionId("basics")} title="Name and web address">
          {issueList("basics")}
          <TextField
            label="Form name"
            value={draft.name}
            onChange={(name) => edit((d) => ({ ...d, name }), k("name"))}
            onBlur={onBlur}
            error={draft.name.trim() ? null : "Give the form a name."}
            hint="The name staff see in the Hub and in inquiry alerts."
            maxLength={120}
          />
          <TextField
            label="Web address"
            prefix={`${host}/inquire/`}
            value={draft.slug}
            onChange={(raw) => edit((d) => ({ ...d, slug: raw.toLowerCase().replace(/\s+/g, "-") }), k("slug"))}
            onBlur={onBlur}
            spellCheck={false}
            disabled={slugLocked && !slugChanged}
            error={
              !isValidSlug(draft.slug)
                ? "Use 3 to 60 lowercase letters, numbers and single dashes."
                : slugLocked && slugChanged
                  ? "A published form keeps its address."
                  : null
            }
            hint={
              slugLocked
                ? "This form is published, so its address may already be on your website. To use a new address, duplicate the form from the forms list."
                : slugChanged
                  ? `Saved address: ${host}/inquire/${savedSlug}`
                  : "Lowercase letters, numbers and dashes, like check-your-date."
            }
            aside={
              slugLocked ? (
                slugChanged ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--brand)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    onClick={() => edit((d) => ({ ...d, slug: savedSlug }))}
                  >
                    Use the saved address
                  </button>
                ) : (
                  <span className="rounded-md bg-[var(--surface-hover)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)]">
                    Locked
                  </span>
                )
              ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--brand)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                onClick={() => {
                  const next = slugFromName(draft.name);
                  if (next && next !== draft.slug) edit((d) => ({ ...d, slug: next }));
                }}
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden /> From name
              </button>
              )
            }
          />
        </PanelSection>

        {/* Brand and color */}
        <PanelSection id={settingsSectionId("brand")} title="Brand and color">
          {issueList("brand")}
          <SelectField
            label="Brand"
            value={s.brand}
            onChange={(brand) =>
              setSettings((prev) => {
                const old = brands.find((b) => b.key === prev.brand);
                const next = brands.find((b) => b.key === brand);
                if (!next) return { ...prev, brand };
                // The color follows the brand unless someone picked their own.
                const followAccent = !old || prev.accentColor.toLowerCase() === old.accentColor.toLowerCase();
                return { ...prev, brand, accentColor: followAccent ? next.accentColor : prev.accentColor };
              })
            }
            options={[
              ...(currentBrand ? [] : [{ value: s.brand, label: s.brand ? `${s.brand} (unknown brand)` : "Pick a brand", disabled: true }]),
              ...brands.map((b) => ({ value: b.key, label: b.name })),
            ]}
            hint="Sets the logo, contact line and legal footer on the form. Picking a brand also picks its color, unless you changed the color."
          />
          {currentBrand ? (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-2.5">
              <span
                className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg px-2 ${
                  currentBrand.logoOnDark ? "bg-[#1a1a1a]" : "bg-white ring-1 ring-[var(--border)]"
                }`}
              >
                {currentBrand.logoUrl ? (
                  // A tiny brand mark that may be remote: a plain img, no next/image config needed.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentBrand.logoUrl} alt={`${currentBrand.name} logo`} className="h-7 w-auto max-w-24 object-contain" />
                ) : (
                  <span className={`text-xs font-bold ${currentBrand.logoOnDark ? "text-white" : "text-[#111827]"}`}>
                    {currentBrand.name}
                  </span>
                )}
              </span>
              <span className="min-w-0 text-xs text-[var(--muted)]">
                <span className="block truncate font-medium text-[var(--foreground)]">{currentBrand.name}</span>
                <span className="block truncate">
                  {[currentBrand.phone, currentBrand.email, currentBrand.siteUrl].filter(Boolean).join(" · ") || "No contact details"}
                </span>
              </span>
            </div>
          ) : null}

          <div className="min-w-0">
            <label htmlFor={`${urgencyGroup}-accent`} className="mb-1 block text-xs font-semibold text-[var(--foreground)]">
              Accent color
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label="Pick the accent color"
                value={normalizeHex(s.accentColor) ?? "#000000"}
                onChange={(e) => setSettings((prev) => ({ ...prev, accentColor: e.target.value }), k("accent"))}
                onBlur={onBlur}
                className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1"
              />
              <input
                id={`${urgencyGroup}-accent`}
                className={`${inputClass} w-32 flex-none font-medium`}
                value={s.accentColor}
                spellCheck={false}
                maxLength={7}
                aria-invalid={accentValid ? undefined : true}
                aria-describedby={`${urgencyGroup}-accent-hint`}
                onChange={(e) => setSettings((prev) => ({ ...prev, accentColor: e.target.value.trim() }), k("accent"))}
                onBlur={onBlur}
              />
              <span
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-white"
                style={{ backgroundColor: accentValid ? (normalizeHex(s.accentColor) ?? undefined) : "#9ca3af" }}
                aria-hidden
              >
                {s.submitLabel.trim() || "Send my request"}
              </span>
            </div>
            <p id={`${urgencyGroup}-accent-hint`} className="mt-1 text-xs text-[var(--muted)]">
              {!accentValid
                ? "Enter a hex color like #e00000."
                : contrast !== null && contrast >= MIN_TEXT_CONTRAST
                  ? `White button text reads well on it (${contrast}:1).`
                  : `White text on it is ${contrast}:1. Buttons need ${MIN_TEXT_CONTRAST}:1 to be easy to read.`}
            </p>
            {darker ? (
              <div className="mt-2">
                <Callout
                  tone="warning"
                  actions={
                    <button type="button" className={btn.secondary} onClick={() => setSettings((prev) => ({ ...prev, accentColor: darker }))}>
                      <span className="h-4 w-4 rounded" style={{ backgroundColor: darker }} aria-hidden /> Use {darker}
                    </button>
                  }
                >
                  This color is too light for white button text. A slightly darker shade of the same color passes.
                </Callout>
              </div>
            ) : null}
          </div>
        </PanelSection>

        {/* Page text */}
        <PanelSection id={settingsSectionId("copy")} title="Page text" description="Optional lines above the first step, and the send button.">
          {issueList("copy")}
          <TextField
            label="Headline (optional)"
            value={s.headline ?? ""}
            onChange={(headline) => setSettings((prev) => ({ ...prev, headline: headline || undefined }), k("headline"))}
            onBlur={onBlur}
            maxLength={200}
            placeholder="Let's check your date"
          />
          <TextField
            label="Subheadline (optional)"
            multiline
            rows={2}
            value={s.subheadline ?? ""}
            onChange={(subheadline) => setSettings((prev) => ({ ...prev, subheadline: subheadline || undefined }), k("subheadline"))}
            onBlur={onBlur}
            maxLength={300}
          />
          <TextField
            label="Send button label"
            value={s.submitLabel}
            onChange={(submitLabel) => setSettings((prev) => ({ ...prev, submitLabel }), k("submitLabel"))}
            onBlur={onBlur}
            maxLength={60}
            error={s.submitLabel.trim() ? null : "Add a label."}
            hint="The button on the last step."
          />
        </PanelSection>

        {/* After sending */}
        <PanelSection id={settingsSectionId("thanks")} title="After sending">
          {issueList("thanks")}
          <TextField
            label="Thank-you title"
            value={s.thankYou.title}
            onChange={(title) => setSettings((prev) => ({ ...prev, thankYou: { ...prev.thankYou, title } }), k("thanks:title"))}
            onBlur={onBlur}
            maxLength={120}
          />
          <TextField
            label="Thank-you message"
            multiline
            rows={3}
            value={s.thankYou.message}
            onChange={(message) => setSettings((prev) => ({ ...prev, thankYou: { ...prev.thankYou, message } }), k("thanks:message"))}
            onBlur={onBlur}
            maxLength={1000}
            hint="Never promise the date: the team confirms availability."
          />
          <TextField
            label="Waitlist thank-you title"
            value={s.waitlistThankYou.title}
            onChange={(title) =>
              setSettings((prev) => ({ ...prev, waitlistThankYou: { ...prev.waitlistThankYou, title } }), k("waitlist:title"))
            }
            onBlur={onBlur}
            maxLength={120}
          />
          <TextField
            label="Waitlist thank-you message"
            multiline
            rows={2}
            value={s.waitlistThankYou.message}
            onChange={(message) =>
              setSettings((prev) => ({ ...prev, waitlistThankYou: { ...prev.waitlistThankYou, message } }), k("waitlist:message"))
            }
            onBlur={onBlur}
            maxLength={1000}
            hint="Shown when someone joins the waitlist for a taken date."
          />
          <TextField
            label="Send visitors to a page instead (optional)"
            type="url"
            value={s.redirectUrl ?? ""}
            onChange={(url) => setSettings((prev) => ({ ...prev, redirectUrl: url.trim() ? url.trim() : null }), k("redirect"))}
            onBlur={onBlur}
            placeholder={HUB_COPY.exampleThankYouUrl}
            spellCheck={false}
            error={redirectBad ? "Use a full address starting with https://" : null}
            hint="After the form is sent, the whole page (or the website around an embedded form) goes here."
          />
        </PanelSection>

        {/* Availability reveal */}
        <PanelSection
          id={settingsSectionId("qualify")}
          title="Availability reveal"
          description="What visitors see while the availability step checks, and when the news is good."
        >
          {issueList("qualify")}
          <ToggleField
            label="Celebrate good news"
            checked={s.qualify.celebrate}
            onChange={(celebrate) => setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, celebrate } }))}
            hint="Confetti and a short popup when the date is open and the place is in range. People who ask for less motion see the message only."
          />
          {s.qualify.celebrate ? (
            <div className="grid gap-3 @lg:grid-cols-2">
              <TextField
                label="Popup title"
                value={s.qualify.popupTitle}
                onChange={(popupTitle) => setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, popupTitle } }), k("popupTitle"))}
                onBlur={onBlur}
                maxLength={80}
              />
              <TextField
                label="Popup subtitle"
                value={s.qualify.popupSubtitle}
                onChange={(popupSubtitle) =>
                  setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, popupSubtitle } }), k("popupSubtitle"))
                }
                onBlur={onBlur}
                maxLength={120}
              />
            </div>
          ) : null}
          <div className="grid gap-3 @lg:grid-cols-2">
            {timing("messageIntervalMs", "Each checking message shows for", "How long each rotating line stays up.")}
            {timing("minCheckMs", "Check for at least", "The animation runs at least this long, even when the answer is instant.")}
            {s.qualify.celebrate ? timing("preCelebrationMs", "Pause before the celebration", "A beat of suspense before the good news.") : null}
            {s.qualify.celebrate ? timing("popupMs", "Popup stays up for", "Then it closes on its own.") : null}
          </div>

          <fieldset className="min-w-0">
            <legend className="mb-1 text-xs font-semibold text-[var(--foreground)]">Urgency line under good news</legend>
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
                <input
                  type="radio"
                  name={urgencyGroup}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                  checked={urgencyMode === "none"}
                  onChange={() => setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, urgency: null } }))}
                />
                <span>None</span>
              </label>
              {URGENCY_PRESETS.map((text, i) => (
                <label
                  key={text}
                  className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                >
                  <input
                    type="radio"
                    name={urgencyGroup}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                    checked={urgencyMode === "preset" && presetIndex === i}
                    onChange={() => setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, urgency: text } }))}
                  />
                  <span>{text}</span>
                </label>
              ))}
              <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-sm text-[var(--foreground)] hover:bg-[var(--surface-hover)]">
                <input
                  type="radio"
                  name={urgencyGroup}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                  checked={urgencyMode === "custom"}
                  onChange={() => setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, urgency: "" } }))}
                />
                <span>Write my own</span>
              </label>
            </div>
            {urgencyMode === "custom" ? (
              <div className="mt-2">
                <TextField
                  label="Your urgency line"
                  multiline
                  rows={2}
                  value={s.qualify.urgency ?? ""}
                  onChange={(urgency) => setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, urgency } }), k("urgency"))}
                  onBlur={onBlur}
                  maxLength={300}
                  error={(s.qualify.urgency ?? "").trim() ? null : "Write the line, or pick None."}
                />
              </div>
            ) : null}
          </fieldset>

          <LinesField
            label="Messages while the date is checked"
            value={s.qualify.dateLoadingMessages}
            onChange={(dateLoadingMessages) =>
              setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, dateLoadingMessages } }), k("dateLoading"))
            }
            onBlur={onBlur}
            rows={5}
            hint="One per line. Leave empty for the standard set."
          />
          <LinesField
            label="Messages while the location is checked"
            value={s.qualify.locationLoadingMessages}
            onChange={(locationLoadingMessages) =>
              setSettings((prev) => ({ ...prev, qualify: { ...prev.qualify, locationLoadingMessages } }), k("locationLoading"))
            }
            onBlur={onBlur}
            rows={5}
            hint="One per line. Leave empty for the standard set."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btn.ghost}
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  qualify: {
                    ...prev.qualify,
                    dateLoadingMessages: [...DATE_LOADING_MESSAGES],
                    locationLoadingMessages: [...LOCATION_LOADING_MESSAGES],
                  },
                }))
              }
            >
              Restore the standard messages
            </button>
          </div>
        </PanelSection>

        {/* Date is taken */}
        <PanelSection id={settingsSectionId("date")} title="When the date is taken" description="Shown after the availability check finds the date busy.">
          {issueList("date")}
          <DateActionsEditor
            value={s.onDateUnavailable.actions}
            onChange={(actions) => setSettings((prev) => ({ ...prev, onDateUnavailable: { ...prev.onDateUnavailable, actions } }))}
          />
          <TextField
            label="Message"
            multiline
            rows={3}
            value={s.onDateUnavailable.message}
            onChange={(message) =>
              setSettings((prev) => ({ ...prev, onDateUnavailable: { ...prev.onDateUnavailable, message } }), k("dateMessage"))
            }
            onBlur={onBlur}
            maxLength={1000}
          />
        </PanelSection>

        {/* Outside your area */}
        <PanelSection
          id={settingsSectionId("location")}
          title="When the place is outside your area"
          description="Shown when the location check puts the event beyond your travel zones."
        >
          {issueList("location")}
          <SegmentedField
            label="What happens"
            value={s.onLocationFail.action}
            onChange={(action) => setSettings((prev) => ({ ...prev, onLocationFail: { ...prev.onLocationFail, action } }))}
            options={[
              { value: "continue", label: "They keep going" },
              { value: "referral", label: "Show referrals" },
            ]}
            hint={
              s.onLocationFail.action === "referral"
                ? "Visitors see the message and your referral links. With no links, they see the thank-you instead."
                : "Visitors see the message and can still send the request."
            }
          />
          <TextField
            label="Message"
            multiline
            rows={3}
            value={s.onLocationFail.message}
            onChange={(message) =>
              setSettings((prev) => ({ ...prev, onLocationFail: { ...prev.onLocationFail, message } }), k("locationMessage"))
            }
            onBlur={onBlur}
            maxLength={1000}
          />
          {s.onLocationFail.action === "referral" ? (
            <div className="space-y-3 rounded-xl border border-[var(--border)] p-3">
              <TextField
                label="Referral title"
                value={s.referral?.title ?? ""}
                onChange={(title) =>
                  setSettings(
                    (prev) => ({ ...prev, referral: { title, message: prev.referral?.message ?? "", links: prev.referral?.links ?? [] } }),
                    k("referral:title"),
                  )
                }
                onBlur={onBlur}
                placeholder="Other great options"
                maxLength={120}
              />
              <TextField
                label="Referral message"
                multiline
                rows={2}
                value={s.referral?.message ?? ""}
                onChange={(message) =>
                  setSettings(
                    (prev) => ({ ...prev, referral: { title: prev.referral?.title ?? "", message, links: prev.referral?.links ?? [] } }),
                    k("referral:message"),
                  )
                }
                onBlur={onBlur}
                placeholder="Here are a few trusted partners who may be able to help."
                maxLength={1000}
              />
              <ReferralLinksEditor
                links={s.referral?.links ?? []}
                onChange={(links, key) =>
                  setSettings(
                    (prev) => ({ ...prev, referral: { title: prev.referral?.title ?? "", message: prev.referral?.message ?? "", links } }),
                    key ? k(key) : undefined,
                  )
                }
                onBlur={onBlur}
              />
              <p className="text-xs text-[var(--muted)]">Referral details are kept once at least one complete link is added.</p>
            </div>
          ) : null}
        </PanelSection>

        {/* Emails and alerts */}
        <PanelSection id={settingsSectionId("emails")} title="Emails and alerts">
          {issueList("emails")}
          <ToggleField
            label="Hub alerts for new inquiries"
            checked={s.notify.inApp}
            onChange={(inApp) => setSettings((prev) => ({ ...prev, notify: { ...prev.notify, inApp } }))}
            hint="The bell and a push alert for every admin."
          />
          <RecipientsEditor
            value={s.notify.recipients}
            onChange={(recipients) => setSettings((prev) => ({ ...prev, notify: { ...prev.notify, recipients } }))}
          />
          <div className="border-t border-[var(--border)] pt-4">
            <ToggleField
              label="Email a confirmation to the visitor"
              checked={s.confirmationEmail.enabled}
              onChange={(enabled) => setSettings((prev) => ({ ...prev, confirmationEmail: { ...prev.confirmationEmail, enabled } }))}
              hint="A copy of their answers, replying to the business inbox. It never promises availability."
            />
            <div className="mt-3">
              <Callout tone="warning" title="This emails every person who submits">
                Every inquiry from this form gets this email, including people outside your area or on a taken date. Read the
                wording before turning it on.
              </Callout>
            </div>
          </div>
          {s.confirmationEmail.enabled ? (
            <>
              <TextField
                label="Email subject"
                value={s.confirmationEmail.subject}
                onChange={(subject) =>
                  setSettings((prev) => ({ ...prev, confirmationEmail: { ...prev.confirmationEmail, subject } }), k("confirm:subject"))
                }
                onBlur={onBlur}
                maxLength={200}
              />
              <TextField
                label="Opening paragraph"
                multiline
                rows={4}
                value={s.confirmationEmail.intro}
                onChange={(intro) =>
                  setSettings((prev) => ({ ...prev, confirmationEmail: { ...prev.confirmationEmail, intro } }), k("confirm:intro"))
                }
                onBlur={onBlur}
                maxLength={2000}
                hint="Their answers are listed under it."
              />
            </>
          ) : null}
        </PanelSection>

        {/* Owners by event type */}
        <PanelSection
          id={settingsSectionId("owners")}
          title="Who owns each event type"
          description="The owner gets the staff email for that type and becomes the owner of the new record when the address has a Hub login."
        >
          {issueList("owners")}
          {eventTypeField && eventTypeChoices.length > 0 ? (
            <div className="grid gap-3 @2xl:grid-cols-2">
              {eventTypeChoices.map((choice) => (
                <TextField
                  key={choice.value}
                  label={choice.label}
                  value={owners[choice.value] ?? ""}
                  onChange={(email) => setOwner(choice.value, email)}
                  onBlur={onBlur}
                  placeholder={HUB_COPY.exampleEmail}
                  maxLength={254}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              This form has no event type question, so every inquiry goes to the staff email above.
            </p>
          )}
          <p className="text-xs text-[var(--muted)]">Leave a type empty to keep it with the admins.</p>
        </PanelSection>

        {/* Copies to other systems */}
        <PanelSection
          id={settingsSectionId("copies")}
          title="Copies to other systems"
          description="The Hub always keeps the inquiry. The copy keeps LeadLeaf fed; turn it off when you stop using it."
        >
          {issueList("copies")}
          <div className="space-y-3">
            <ToggleField
              label="Copy each inquiry to GoHighLevel"
              checked={Boolean(ghl?.enabled)}
              onChange={(enabled) => setGhl({ enabled })}
              hint="Sent the same way your website's own contact form sends it, so GoHighLevel's follow-ups keep running."
            />
            {ghl?.enabled ? (
              <div className="grid gap-3 @2xl:grid-cols-2">
                <TextField label="Location id" value={ghl.locationId} onChange={(locationId) => setGhl({ locationId }, "ghl:location")} onBlur={onBlur} maxLength={80} />
                <TextField label="Tracking id" value={ghl.trackingId} onChange={(trackingId) => setGhl({ trackingId }, "ghl:tracking")} onBlur={onBlur} maxLength={80} />
                <TextField
                  label="Form name in GoHighLevel"
                  value={ghl.formId}
                  onChange={(formId) => setGhl({ formId }, "ghl:form")}
                  onBlur={onBlur}
                  maxLength={120}
                />
                <TextField
                  label="Website page"
                  value={ghl.siteUrl}
                  onChange={(siteUrl) => setGhl({ siteUrl }, "ghl:site")}
                  onBlur={onBlur}
                  maxLength={500}
                  placeholder="https://"
                />
                <TextField
                  label="Field for the answers"
                  value={ghl.notesKey}
                  onChange={(notesKey) => setGhl({ notesKey }, "ghl:notesKey")}
                  onBlur={onBlur}
                  maxLength={80}
                />
                <TextField
                  label="Label for the answers"
                  value={ghl.notesLabel}
                  onChange={(notesLabel) => setGhl({ notesLabel }, "ghl:notesLabel")}
                  onBlur={onBlur}
                  maxLength={80}
                />
                <TextField
                  label="Event type field (optional)"
                  value={ghl.eventTypeKey ?? ""}
                  onChange={(v) => setGhl({ eventTypeKey: v.trim() ? v : null }, "ghl:typeKey")}
                  onBlur={onBlur}
                  maxLength={80}
                />
                <TextField
                  label="Services field (optional)"
                  value={ghl.servicesKey ?? ""}
                  onChange={(v) => setGhl({ servicesKey: v.trim() ? v : null }, "ghl:servicesKey")}
                  onBlur={onBlur}
                  maxLength={80}
                />
              </div>
            ) : null}
          </div>
          <p className="text-xs text-[var(--muted)]">
            A copy that does not go through is retried for 24 hours. Each attempt shows in the submission&apos;s history.
          </p>
        </PanelSection>

        {/* Website embed */}
        <PanelSection id={settingsSectionId("embed")} title="Website embed">
          {issueList("embed")}
          <ToggleField
            label="Tell the website when someone sends the form"
            checked={s.hostEvent}
            onChange={(hostEvent) => setSettings((prev) => ({ ...prev, hostEvent }))}
            hint="For conversion tracking on the page that embeds the form: sends an inquiry_form_submitted event to Google Tag Manager and a Meta Pixel Lead when the pixel is on that page."
          />
        </PanelSection>

        {/* Progress labels */}
        <PanelSection
          id={settingsSectionId("progress")}
          title="Fun progress labels (optional)"
          description="One line per step, shown with the progress bar. Leave empty for the plain bar."
        >
          {issueList("progress")}
          <LinesField
            label="Labels"
            value={s.progressHype ?? []}
            onChange={(lines) => setSettings((prev) => ({ ...prev, progressHype: lines.length ? lines : null }), k("hype"))}
            onBlur={onBlur}
            rows={4}
            placeholder={"Getting warmed up...\nHype is building!\nAlmost at full hype!\nMAX HYPE!"}
          />
          {(s.progressHype?.length ?? 0) > 0 && (s.progressHype?.length ?? 0) < draft.definition.steps.length ? (
            <p className="flex items-start gap-1.5 text-xs text-[var(--muted)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              The form has {draft.definition.steps.length} steps and {s.progressHype?.length} labels. Add one per step so every
              step gets its own.
            </p>
          ) : null}
        </PanelSection>
      </div>
    </div>
  );
}
