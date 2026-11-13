"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cake,
  CalendarDays,
  Link2,
  Mail,
  Pencil,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import { updateOwnProfileDetailsAction } from "@/app/(app)/people/actions";
import { AdminGrantPointsForm } from "@/components/points/admin-grant-points-form";
import { PersonAwardBadges } from "@/components/points/monthly-award-badges";
import {
  colorSoftBackground,
  normalizeHexColor,
} from "@/lib/people/color";
import { listProfileSocialLinks } from "@/lib/people/social-links";
import type { PersonAwardSummary } from "@/lib/points/monthly-awards-types";
import {
  ROLE_LABELS,
  type Profile,
} from "@/lib/types/database";
import {
  managerForDepartment,
  type DepartmentManagerMap,
} from "@/lib/types/department-managers";

type PersonDetailModalProps = {
  open: boolean;
  profile: Profile | null;
  profiles: Profile[];
  departmentManagers?: DepartmentManagerMap;
  viewerId: string | null;
  isAdmin: boolean;
  awardSummary?: PersonAwardSummary | null;
  onClose: () => void;
  onAdminEdit: (profile: Profile) => void;
};

function formatLongDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-[var(--foreground)]">{children}</div>
      </div>
    </div>
  );
}

export function PersonDetailModal({
  open,
  profile,
  profiles,
  departmentManagers = {},
  viewerId,
  isAdmin,
  awardSummary = null,
  onClose,
  onAdminEdit,
}: PersonDetailModalProps) {
  const router = useRouter();
  const titleId = useId();
  const [editingSelf, setEditingSelf] = useState(false);
  const [phone, setPhone] = useState(() => profile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(() => profile?.avatar_url ?? "");
  const [bio, setBio] = useState(() => profile?.bio ?? "");
  const [facebookUrl, setFacebookUrl] = useState(
    () => profile?.facebook_url ?? "",
  );
  const [instagramUrl, setInstagramUrl] = useState(
    () => profile?.instagram_url ?? "",
  );
  const [linkedinUrl, setLinkedinUrl] = useState(
    () => profile?.linkedin_url ?? "",
  );
  const [twitterUrl, setTwitterUrl] = useState(
    () => profile?.twitter_url ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !profile) return null;

  const name = profile.full_name?.trim() || profile.email;
  const hex = normalizeHexColor(profile.color);
  const isSelf = Boolean(viewerId && viewerId === profile.id);
  const managerLines = profile.departments.map((dept) => {
    const managerId = managerForDepartment(
      departmentManagers,
      profile.id,
      dept,
      profile.reports_to,
    );
    const manager = managerId
      ? profiles.find((p) => p.id === managerId)
      : null;
    return {
      department: dept,
      name: manager
        ? manager.full_name?.trim() || manager.email
        : null,
    };
  });
  const birthday = formatLongDate(profile.birthday);
  const startDate = formatLongDate(profile.start_date);
  const socialLinks = listProfileSocialLinks(profile);

  function handleSaveSelf() {
    setError(null);
    startTransition(async () => {
      const result = await updateOwnProfileDetailsAction({
        phone,
        avatar_url: avatarUrl,
        bio,
        facebook_url: facebookUrl,
        instagram_url: instagramUrl,
        linkedin_url: linkedinUrl,
        twitter_url: twitterUrl,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditingSelf(false);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--foreground)]/40"
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-start gap-4 border-b border-[var(--border)] p-5">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full object-cover"
              style={hex ? { boxShadow: `0 0 0 2px ${hex}` } : undefined}
            />
          ) : (
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
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
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--foreground)]"
            >
              {name}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {profile.title || ROLE_LABELS[profile.role]}
            </p>
            {profile.departments.length > 0 ||
            (awardSummary &&
              (awardSummary.currentOverall ||
                awardSummary.currentMvp ||
                awardSummary.totalWins > 0)) ? (
              <p className="mt-2 flex flex-wrap gap-1.5">
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
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!editingSelf ? (
            <>
              <DetailRow icon={Mail} label="Email">
                <a
                  href={`mailto:${profile.email}`}
                  className="break-all hover:text-[var(--brand)]"
                >
                  {profile.email}
                </a>
              </DetailRow>
              <DetailRow icon={Phone} label="Phone">
                {profile.phone ? (
                  <a
                    href={`tel:${profile.phone}`}
                    className="hover:text-[var(--brand)]"
                  >
                    {profile.phone}
                  </a>
                ) : (
                  <span className="text-[var(--muted)]">Not set</span>
                )}
              </DetailRow>
              <DetailRow icon={UserRound} label="Role">
                {ROLE_LABELS[profile.role]}
              </DetailRow>
              {managerLines.length > 0 ? (
                <DetailRow icon={UserRound} label="Reports to">
                  <ul className="space-y-1">
                    {managerLines.map((line) => (
                      <li key={line.department}>
                        <span className="font-medium">{line.department}:</span>{" "}
                        {line.name ?? (
                          <span className="text-[var(--muted)]">Top-level</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </DetailRow>
              ) : profile.reports_to ? (
                <DetailRow icon={UserRound} label="Reports to">
                  {profiles.find((p) => p.id === profile.reports_to)
                    ?.full_name ||
                    profiles.find((p) => p.id === profile.reports_to)?.email ||
                    "Assigned"}
                </DetailRow>
              ) : null}
              {birthday ? (
                <DetailRow icon={Cake} label="Birthday">
                  {birthday}
                </DetailRow>
              ) : null}
              {startDate ? (
                <DetailRow icon={CalendarDays} label="Start date">
                  {startDate}
                </DetailRow>
              ) : null}
              <DetailRow icon={UserRound} label="Bio">
                {profile.bio?.trim() ? (
                  <p className="whitespace-pre-wrap">{profile.bio}</p>
                ) : (
                  <span className="text-[var(--muted)]">No bio yet</span>
                )}
              </DetailRow>
              <DetailRow icon={Link2} label="Social">
                {socialLinks.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {socialLinks.map((link) => (
                      <li key={link.key}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--brand)] hover:bg-[var(--surface-hover)]"
                        >
                          {link.short}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[var(--muted)]">No links yet</span>
                )}
              </DetailRow>

              <div className="flex flex-wrap gap-2 pt-2">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onAdminEdit(profile);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit profile
                  </button>
                ) : null}
                {isSelf ? (
                  <button
                    type="button"
                    onClick={() => setEditingSelf(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit my details &amp; social links
                  </button>
                ) : null}
              </div>

              {isAdmin ? (
                <AdminGrantPointsForm
                  userId={profile.id}
                  userName={name}
                />
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                Update the details others see for you on People.
              </p>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Phone
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                  placeholder="401-555-1234"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Avatar URL
                </span>
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                  placeholder="https://…"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Bio
                </span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                  placeholder="A short intro for the team…"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Facebook URL
                </span>
                <input
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                  placeholder="https://facebook.com/…"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Instagram URL
                </span>
                <input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                  placeholder="https://instagram.com/…"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  LinkedIn URL
                </span>
                <input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                  placeholder="https://linkedin.com/in/…"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--foreground)]">
                  X (Twitter) URL
                </span>
                <input
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                  placeholder="https://x.com/…"
                />
              </label>
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveSelf}
                  disabled={pending}
                  className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSelf(false);
                    setError(null);
                    setPhone(profile.phone ?? "");
                    setAvatarUrl(profile.avatar_url ?? "");
                    setBio(profile.bio ?? "");
                    setFacebookUrl(profile.facebook_url ?? "");
                    setInstagramUrl(profile.instagram_url ?? "");
                    setLinkedinUrl(profile.linkedin_url ?? "");
                    setTwitterUrl(profile.twitter_url ?? "");
                  }}
                  className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
