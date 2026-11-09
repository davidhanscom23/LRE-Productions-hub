"use client";

/**
 * Inquiry Forms builder - a small, non-interactive picture of how a field will look to a
 * visitor. Used inside the canvas cards and the drag clone. Nothing here is focusable.
 */
import { CalendarDays, ChevronDown, Clock, Eye, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import type { FieldDef, FormDefinition } from "@/lib/inquiry-forms/types";
import { CONTACT_PREFERENCE_CHOICES } from "./builder-catalog";
import { locateFieldByKey, showIfChoicesFor } from "./builder-ops";

const boxClass =
  "flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--muted)]";

function FakeInput({ text, icon, trailing }: { text: string; icon?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className={boxClass}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {trailing}
    </div>
  );
}

const MAX_CHOICES = 4;

function ChoicesPreview({ field }: { field: FieldDef }) {
  const choices = field.choices ?? [];
  if (field.type === "checkbox" && choices.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--foreground)]">
        <span className="h-3.5 w-3.5 shrink-0 rounded border border-[var(--muted)]" />
        <span className="truncate">{field.label || "Checkbox"}</span>
      </div>
    );
  }
  if (choices.length === 0) {
    return <p className="text-xs font-medium text-amber-800 dark:text-amber-200">No choices yet</p>;
  }
  const shown = choices.slice(0, MAX_CHOICES);
  const more = choices.length - shown.length;
  if (field.type === "select") {
    return (
      <FakeInput
        text={field.placeholder || "Choose..."}
        trailing={<ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      />
    );
  }
  const layout = field.layout ?? "list";
  if (layout === "chips" || layout === "cards") {
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map((c) => (
          <span
            key={c.value}
            className={`max-w-full truncate border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--foreground)] ${
              layout === "chips" ? "rounded-full" : "rounded-md"
            }`}
          >
            {c.label || "Untitled"}
          </span>
        ))}
        {more > 0 ? <span className="px-1 py-0.5 text-[11px] text-[var(--muted)]">+{more} more</span> : null}
      </div>
    );
  }
  return (
    <ul className="space-y-0.5">
      {shown.map((c) => (
        <li key={c.value} className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--foreground)]">
          <span
            className={`h-3 w-3 shrink-0 border border-[var(--muted)] ${field.type === "radio" ? "rounded-full" : "rounded-sm"}`}
          />
          <span className="truncate">{c.label || "Untitled"}</span>
        </li>
      ))}
      {more > 0 ? <li className="pl-[18px] text-[11px] text-[var(--muted)]">+{more} more</li> : null}
    </ul>
  );
}

function BudgetPreview({ field }: { field: FieldDef }) {
  const b = field.budget;
  if (!b) return <p className="text-xs font-medium text-amber-800 dark:text-amber-200">No budget setup</p>;
  if (b.mode === "slider") {
    const s = b.slider;
    return (
      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-[var(--border)]">
          <div className="h-1.5 w-2/5 rounded-full bg-[var(--brand)]" />
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          {s ? `$${s.min.toLocaleString("en-US")} to $${s.max.toLocaleString("en-US")}` : "Slider"}
        </p>
      </div>
    );
  }
  const tiers = b.tiers ?? [];
  return (
    <div className="flex flex-wrap gap-1">
      {tiers.slice(0, MAX_CHOICES).map((t) => (
        <span
          key={t.id}
          className="max-w-full truncate rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--foreground)]"
        >
          {t.label || "Untitled"}
        </span>
      ))}
      {tiers.length > MAX_CHOICES ? (
        <span className="px-1 py-0.5 text-[11px] text-[var(--muted)]">+{tiers.length - MAX_CHOICES} more</span>
      ) : null}
    </div>
  );
}

export function FieldPreview({ field }: { field: FieldDef }) {
  const icon = "h-3.5 w-3.5 shrink-0";
  switch (field.type) {
    case "text":
    case "number":
      return <FakeInput text={field.placeholder || (field.type === "number" ? "0" : "Type here")} />;
    case "email":
      return <FakeInput text={field.placeholder || "name@example.com"} icon={<Mail className={icon} aria-hidden />} />;
    case "phone":
      return <FakeInput text={field.placeholder || "(904) 555-0123"} icon={<Phone className={icon} aria-hidden />} />;
    case "address":
      return <FakeInput text={field.placeholder || "Venue or address"} icon={<MapPin className={icon} aria-hidden />} />;
    case "date":
      return <FakeInput text="mm/dd/yyyy" icon={<CalendarDays className={icon} aria-hidden />} />;
    case "time":
      return (
        <FakeInput
          text={field.showEndTime ? "Start time to end time" : "Start time"}
          icon={<Clock className={icon} aria-hidden />}
        />
      );
    case "textarea":
      return (
        <div className="h-12 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--muted)]">
          <span className="line-clamp-2">{field.placeholder || "A few sentences"}</span>
        </div>
      );
    case "select":
    case "radio":
    case "checkbox":
      return <ChoicesPreview field={field} />;
    case "budget":
      return <BudgetPreview field={field} />;
    case "contact_preference":
      return (
        <div className="flex flex-wrap gap-1">
          {CONTACT_PREFERENCE_CHOICES.map((c) => (
            <span
              key={c.value}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[11px] text-[var(--foreground)]"
            >
              {c.value === "email" ? (
                <Mail className="h-3 w-3" aria-hidden />
              ) : c.value === "text" ? (
                <MessageSquare className="h-3 w-3" aria-hidden />
              ) : (
                <Phone className="h-3 w-3" aria-hidden />
              )}
              {c.label}
            </span>
          ))}
        </div>
      );
    case "content":
      return (
        <p
          className={`line-clamp-3 rounded-md px-2 py-1.5 text-xs ${
            field.content?.tone === "muted"
              ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
              : "bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100"
          }`}
        >
          {field.content?.text?.trim() || "Empty text block"}
        </p>
      );
    default:
      return null;
  }
}

/** Plain words for a rule operator; `many` = more than one value picked. */
export function opPhrase(op: string, many: boolean): string {
  switch (op) {
    case "equals":
      return many ? "is any of" : "is";
    case "not_equals":
      return many ? "is none of" : "is not";
    case "includes":
      return many ? "includes any of" : "includes";
    case "not_includes":
      return many ? "includes none of" : "does not include";
    default:
      return "is answered";
  }
}

/** "Shown when "Services" includes Photo Booth" (plain words for the canvas card). */
export function showIfSummary(def: FormDefinition, field: FieldDef): string | null {
  const rule = field.showIf;
  if (!rule) return null;
  const source = locateFieldByKey(def, rule.fieldKey);
  if (!source) return "Shown when a deleted question is answered";
  const name = source.field.label.trim() || source.field.key;
  if (rule.op === "answered") return `Shown when "${name}" is answered`;
  const labels = new Map(showIfChoicesFor(source.field).map((c) => [c.value, c.label]));
  const values = (rule.values ?? []).map((v) => labels.get(v) ?? v);
  if (values.length === 0) return `Shown when "${name}" ${opPhrase(rule.op, false)} (pick an answer)`;
  return `Shown when "${name}" ${opPhrase(rule.op, values.length > 1)} ${values.join(", ")}`;
}

export function ShowIfBadge({ text }: { text: string }) {
  return (
    <p className="flex min-w-0 items-start gap-1 text-[11px] text-[var(--muted)]">
      <Eye className="mt-px h-3 w-3 shrink-0" aria-hidden />
      <span className="line-clamp-2">{text}</span>
    </p>
  );
}
