"use client";

import { Award, Cake, Link2, Mail, Pencil, Phone } from "lucide-react";
import { PersonAwardBadges } from "@/components/points/monthly-award-badges";
import {
  colorSoftBackground,
  normalizeHexColor,
} from "@/lib/people/color";
import { daysUntilAnniversary } from "@/lib/people/anniversaries";
import { daysUntilBirthday } from "@/lib/people/birthdays";
import { listProfileSocialLinks } from "@/lib/people/social-links";
import type { PersonAwardSummary } from "@/lib/points/monthly-awards-types";
import type { Profile } from "@/lib/types/database";
import { ROLE_LABELS } from "@/lib/types/database";

type PersonCardProps = {
  profile: Profile;
  isAdmin: boolean;
  /** Admin-only: active staff/trainer is missing a personal calendar feed. */
  awardSummary?: PersonAwardSummary | null;
  onOpen: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
};

function Avatar({
  name,
  avatarUrl,
  color,
  sizeClass,
  textClass,
}: {
  name: string;
  avatarUrl: string | null;
  color: string | null;
  sizeClass: string;
  textClass: string;
}) {
  const initial = name.charAt(0).toUpperCase();
  const hex = normalizeHexColor(color);
  const ringStyle = hex
    ? { boxShadow: `0 0 0 2px ${hex}` }
    : undefined;

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} rounded-full object-cover`}
        style={ringStyle}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-semibold ${textClass}`}
      style={
        hex
          ? {
              backgroundColor: colorSoftBackground(hex, 0.22),
              color: hex,
              boxShadow: `0 0 0 2px ${hex}`,
            }
          : {
              backgroundColor: "var(--brand-soft)",
              color: "var(--brand)",
            }
      }
    >
      {initial}
    </div>
  );
}

export function PersonCard({
  profile,
  isAdmin,
  awardSummary = null,
  onOpen,
  onEdit,
}: PersonCardProps) {
  const name = profile.full_name?.trim() || profile.email;
  const hex = normalizeHexColor(profile.color);
  const socialLinks = listProfileSocialLinks(profile);
  const birthdayToday = Boolean(
    profile.birthday && daysUntilBirthday(profile.birthday) === 0,
  );
  const anniversaryToday = Boolean(
    profile.start_date && daysUntilAnniversary(profile.start_date) === 0,
  );
  const hasMonthlyAwards = Boolean(
    awardSummary &&
      (awardSummary.currentOverall ||
        awardSummary.currentMvp ||
        awardSummary.totalWins > 0),
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(profile)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(profile);
        }
      }}
      className="group relative flex cursor-pointer flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-colors hover:border-[var(--brand)]/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      style={
        hex
          ? {
              borderLeftWidth: 4,
              borderLeftColor: hex,
            }
          : undefined
      }
      aria-label={`View details for ${name}`}
    >
      {isAdmin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(profile);
          }}
          className="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus:opacity-100"
          aria-label={`Edit ${name}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="flex items-start gap-3">
        <Avatar
          name={name}
          avatarUrl={profile.avatar_url}
          color={profile.color}
          sizeClass="h-12 w-12"
          textClass="text-base"
        />
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="truncate text-base font-semibold text-[var(--foreground)]">
            {name}
          </h3>
          <p className="truncate text-sm text-[var(--muted)]">
            {profile.title || ROLE_LABELS[profile.role]}
          </p>
          {(birthdayToday || anniversaryToday) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {birthdayToday ? (
                <p className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
                  <Cake className="h-3 w-3" />
                  Happy Birthday!
                </p>
              ) : null}
              {anniversaryToday ? (
                <p className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
                  <Award className="h-3 w-3" />
                  Happy Anniversary!
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        {(profile.departments.length > 0 || hasMonthlyAwards) && (
          <p className="flex flex-wrap gap-1.5">
            {profile.departments.map((dept) => (
              <span
                key={dept}
                className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
                style={
                  hex
                    ? {
                        backgroundColor: colorSoftBackground(hex, 0.18),
                        color: hex,
                      }
                    : {
                        backgroundColor: "var(--brand-soft)",
                        color: "var(--brand)",
                      }
                }
              >
                {dept}
              </span>
            ))}
            <PersonAwardBadges summary={awardSummary} />
          </p>
        )}
        <p className="flex items-center gap-2 truncate text-[var(--muted)]">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <a
            href={`mailto:${profile.email}`}
            onClick={(e) => e.stopPropagation()}
            className="truncate hover:text-[var(--brand)]"
          >
            {profile.email}
          </a>
        </p>
        {profile.phone ? (
          <p className="flex items-center gap-2 text-[var(--muted)]">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <a
              href={`tel:${profile.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-[var(--brand)]"
            >
              {profile.phone}
            </a>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[var(--muted)]/60">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            No phone
          </p>
        )}
        {socialLinks.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1.5 pt-1">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            {socialLinks.map((link) => (
              <a
                key={link.key}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--brand)] hover:bg-[var(--surface-hover)]"
              >
                {link.short}
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </article>
  );
}

type BirthdayRowProps = {
  name: string;
  departments: string[];
  label: string;
  daysUntil: number;
  avatarUrl: string | null;
  color?: string | null;
};

export function BirthdayRow({
  name,
  departments,
  label,
  daysUntil,
  avatarUrl,
  color = null,
}: BirthdayRowProps) {
  const hex = normalizeHexColor(color);
  const when =
    daysUntil === 0
      ? "Today"
      : daysUntil === 1
        ? "Tomorrow"
        : `In ${daysUntil} days`;
  const deptLabel =
    departments.length > 0 ? departments.join(", ") : "No department";

  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
      style={
        hex
          ? {
              borderLeftWidth: 4,
              borderLeftColor: hex,
            }
          : undefined
      }
    >
      <Avatar
        name={name}
        avatarUrl={avatarUrl}
        color={color}
        sizeClass="h-10 w-10"
        textClass="text-sm"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[var(--foreground)]">{name}</p>
        <p className="truncate text-sm text-[var(--muted)]">
          {deptLabel} · {label}
        </p>
      </div>
      <div
        className="flex items-center gap-1.5 text-sm font-medium"
        style={{ color: hex ?? "var(--brand)" }}
      >
        <Cake className="h-4 w-4" />
        {when}
      </div>
    </div>
  );
}

type AnniversaryRowProps = {
  name: string;
  departments: string[];
  label: string;
  yearsLabel: string;
  daysUntil: number;
  avatarUrl: string | null;
  color?: string | null;
};

export function AnniversaryRow({
  name,
  departments,
  label,
  yearsLabel,
  daysUntil,
  avatarUrl,
  color = null,
}: AnniversaryRowProps) {
  const hex = normalizeHexColor(color);
  const when =
    daysUntil === 0
      ? "Today"
      : daysUntil === 1
        ? "Tomorrow"
        : `In ${daysUntil} days`;
  const deptLabel =
    departments.length > 0 ? departments.join(", ") : "No department";

  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
      style={
        hex
          ? {
              borderLeftWidth: 4,
              borderLeftColor: hex,
            }
          : undefined
      }
    >
      <Avatar
        name={name}
        avatarUrl={avatarUrl}
        color={color}
        sizeClass="h-10 w-10"
        textClass="text-sm"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[var(--foreground)]">{name}</p>
        <p className="truncate text-sm text-[var(--muted)]">
          {deptLabel} · {label} · {yearsLabel}
        </p>
      </div>
      <div
        className="flex items-center gap-1.5 text-sm font-medium"
        style={{ color: hex ?? "var(--brand)" }}
      >
        <Award className="h-4 w-4" />
        {when}
      </div>
    </div>
  );
}
