"use client";

import Link from "next/link";
import { progressLabel } from "@/lib/training/progress";
import type { CourseProgress } from "@/lib/types/training";

export type TrackingCourse = {
  id: string;
  slug: string;
  title: string;
  lessonCount: number;
};

export type TrackingStaffRow = {
  userId: string;
  name: string;
  byCourse: Record<
    string,
    {
      completedLessons: number;
      progress: CourseProgress;
    }
  >;
};

type TrainingTrackingPanelProps = {
  courses: TrackingCourse[];
  staffRows: TrackingStaffRow[];
};

export function TrainingTrackingPanel({
  courses,
  staffRows,
}: TrainingTrackingPanelProps) {
  const totals = {
    completed: 0,
    in_progress: 0,
    not_started: 0,
  };

  for (const row of staffRows) {
    for (const course of courses) {
      const entry = row.byCourse[course.id];
      if (!entry) continue;
      if (entry.progress.status === "completed") totals.completed += 1;
      else if (entry.progress.status === "in_progress") totals.in_progress += 1;
      else if (entry.progress.status === "not_started") totals.not_started += 1;
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Completion tracking
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Who has started or finished published Training Portal courses.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Course completions", value: totals.completed },
          { label: "In progress", value: totals.in_progress },
          { label: "Not started", value: totals.not_started },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <p className="text-xs text-[var(--muted)]">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {courses.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-sm text-[var(--muted)]">
          No published courses yet.
        </p>
      ) : (
        courses.map((course) => {
          const rows = staffRows
            .map((staff) => ({
              ...staff,
              entry: staff.byCourse[course.id],
            }))
            .filter((row) => row.entry)
            .sort((a, b) => {
              const order = {
                in_progress: 0,
                not_started: 1,
                completed: 2,
                locked: 3,
              } as const;
              const aStatus = a.entry!.progress.status;
              const bStatus = b.entry!.progress.status;
              if (order[aStatus] !== order[bStatus]) {
                return order[aStatus] - order[bStatus];
              }
              return a.name.localeCompare(b.name);
            });

          return (
            <section key={course.id} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-[var(--foreground)]">
                  {course.title}
                </h3>
                <Link
                  href={`/training-portal/${course.slug}`}
                  className="text-sm font-medium text-[var(--brand)] hover:underline"
                >
                  Open course
                </Link>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Staff</th>
                      <th className="px-4 py-2 font-medium">Lessons</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-4 text-[var(--muted)]"
                        >
                          No active staff profiles to track.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={`${course.id}-${row.userId}`}>
                          <td className="px-4 py-2 font-medium text-[var(--foreground)]">
                            {row.name}
                          </td>
                          <td className="px-4 py-2 text-[var(--muted)]">
                            {row.entry!.completedLessons}/{course.lessonCount}
                          </td>
                          <td className="px-4 py-2">
                            {progressLabel(row.entry!.progress)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
