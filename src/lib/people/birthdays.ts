import type { Profile } from "@/lib/types/database";

/** Days from today until the next occurrence of this birthday (0 = today). */
export function daysUntilBirthday(birthday: string, from = new Date()): number {
  const [, month, day] = birthday.split("-").map(Number);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }

  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatBirthdayLabel(birthday: string): string {
  const date = new Date(`${birthday}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

export function upcomingBirthdays(
  profiles: Profile[],
  limit = 20,
  withinDays?: number,
) {
  return profiles
    .filter((p) => p.is_active && p.birthday)
    .map((profile) => ({
      profile,
      daysUntil: daysUntilBirthday(profile.birthday!),
      label: formatBirthdayLabel(profile.birthday!),
    }))
    .filter((row) =>
      withinDays == null ? true : row.daysUntil <= withinDays,
    )
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, limit);
}
