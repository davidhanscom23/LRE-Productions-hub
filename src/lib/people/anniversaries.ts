import type { Profile } from "@/lib/types/database";

/** Days until the next hire-date anniversary (0 = today). */
export function daysUntilAnniversary(
  startDate: string,
  from = new Date(),
): number {
  const [, month, day] = startDate.split("-").map(Number);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }

  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Years of service completed on the next anniversary date. */
export function yearsAtNextAnniversary(
  startDate: string,
  from = new Date(),
): number {
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return 0;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return Math.max(0, next.getFullYear() - year);
}

export function formatAnniversaryLabel(startDate: string): string {
  const date = new Date(`${startDate}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
}

export function formatYearsLabel(years: number): string {
  if (years <= 0) return "Hire day";
  if (years === 1) return "1st year";
  if (years === 2) return "2nd year";
  if (years === 3) return "3rd year";
  return `${years}th year`;
}

export function upcomingAnniversaries(
  profiles: Profile[],
  limit = 20,
  withinDays?: number,
) {
  return profiles
    .filter((p) => p.is_active && p.start_date)
    .map((profile) => {
      const startDate = profile.start_date!;
      const years = yearsAtNextAnniversary(startDate);
      return {
        profile,
        daysUntil: daysUntilAnniversary(startDate),
        label: formatAnniversaryLabel(startDate),
        years,
        yearsLabel: formatYearsLabel(years),
      };
    })
    .filter((row) =>
      withinDays == null ? true : row.daysUntil <= withinDays,
    )
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, limit);
}
