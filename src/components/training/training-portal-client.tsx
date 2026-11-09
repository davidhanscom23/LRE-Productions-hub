"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  GraduationCap,
  Lock,
  PlayCircle,
  Search,
} from "lucide-react";
import {
  TrainingManagePanel,
  type ManageCourse,
} from "@/components/training/training-manage-panel";
import {
  TrainingTrackingPanel,
  type TrackingCourse,
  type TrackingStaffRow,
} from "@/components/training/training-tracking-panel";
import { filterCoursesByQuery } from "@/lib/training/match-courses";
import { courseAudienceDepartments } from "@/lib/training/audience-access";
import { progressLabel } from "@/lib/training/progress";
import { DEPARTMENTS, type Department } from "@/lib/types/database";
import type { CourseProgress, TrainingCourse } from "@/lib/types/training";

export type CatalogCourse = TrainingCourse & {
  lessonCount: number;
  progress: CourseProgress;
};

/** One course row in the catalog. Top-level so it isn't redefined per render. */
function CourseCard({ course }: { course: CatalogCourse }) {
  const locked = course.progress.status === "locked";
  const inner = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[var(--foreground)]">
            {course.title}
          </p>
          <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
            {course.audience}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">{course.blurb}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <PlayCircle className="h-3.5 w-3.5" />
          {locked
            ? "Coming soon"
            : `${course.lessonCount} lesson${
                course.lessonCount === 1 ? "" : "s"
              }${
                course.progress.status === "completed"
                  ? " · Finished"
                  : " · Open to start"
              }`}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
        {course.progress.status === "completed" ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Completed
          </>
        ) : course.progress.status === "in_progress" ? (
          <>
            <Circle className="h-3.5 w-3.5 text-[var(--brand)]" />
            {progressLabel(course.progress)}
          </>
        ) : locked ? (
          <>
            <Lock className="h-3.5 w-3.5 opacity-50" />
            Locked
          </>
        ) : (
          <>
            <Circle className="h-3.5 w-3.5 text-[var(--brand)]" />
            Not started
          </>
        )}
      </span>
    </div>
  );

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      {locked ? (
        inner
      ) : (
        <Link
          href={`/training-portal/${course.slug}`}
          className="block rounded-xl outline-none transition-colors hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          {inner}
        </Link>
      )}
    </li>
  );
}

const ALL_STAFF_GROUP = "All staff";

/** Group courses into "All staff" + one bucket per department (in order). */
function groupCoursesByDepartment(
  courses: CatalogCourse[],
): { label: string; courses: CatalogCourse[] }[] {
  const all: CatalogCourse[] = [];
  const byDept = new Map<Department, CatalogCourse[]>(
    DEPARTMENTS.map((d) => [d, [] as CatalogCourse[]]),
  );
  for (const course of courses) {
    const target = courseAudienceDepartments(course.audience);
    if (target === "all") {
      all.push(course);
    } else {
      for (const dept of target) byDept.get(dept)?.push(course);
    }
  }
  const groups: { label: string; courses: CatalogCourse[] }[] = [];
  if (all.length) groups.push({ label: ALL_STAFF_GROUP, courses: all });
  for (const dept of DEPARTMENTS) {
    const list = byDept.get(dept) ?? [];
    if (list.length) groups.push({ label: dept, courses: list });
  }
  return groups;
}

type TabId = "catalog" | "tracking" | "manage";

type TrainingPortalClientProps = {
  courses: CatalogCourse[];
  inProgressCount: number;
  completedCount: number;
  canTrack: boolean;
  canDelete: boolean;
  trackingCourses: TrackingCourse[];
  trackingStaffRows: TrackingStaffRow[];
  manageCourses: ManageCourse[];
};

export function TrainingPortalClient({
  courses,
  inProgressCount,
  completedCount,
  canTrack,
  canDelete,
  trackingCourses,
  trackingStaffRows,
  manageCourses,
}: TrainingPortalClientProps) {
  const [tab, setTab] = useState<TabId>("catalog");
  const [query, setQuery] = useState("");

  const tabs: { id: TabId; label: string; adminOnly?: boolean }[] = [
    { id: "catalog", label: "Catalog" },
    { id: "tracking", label: "Tracking", adminOnly: true },
    { id: "manage", label: "Manage", adminOnly: true },
  ];

  const trimmedQuery = query.trim();
  const visibleCourses = useMemo(
    () => filterCoursesByQuery(courses, trimmedQuery),
    [courses, trimmedQuery],
  );
  const groupedCourses = useMemo(
    () => groupCoursesByDepartment(visibleCourses),
    [visibleCourses],
  );
  const searching = trimmedQuery.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--brand-soft)] via-[var(--surface)] to-[var(--surface)] px-5 py-6 sm:px-7">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-[var(--brand)]">Training Portal</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--foreground)]">Courses & progress</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">Self-paced written courses for Vident Productions teams. Track lesson progress here; use Teams for live tutorial videos.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Courses", value: String(courses.length) },
          { label: "In progress", value: String(inProgressCount) },
          { label: "Completed", value: String(completedCount) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {canTrack ? (
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
          {tabs
            .filter((item) => !item.adminOnly || canTrack)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  tab === item.id
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
        </div>
      ) : null}

      {tab === "tracking" && canTrack ? (
        <TrainingTrackingPanel
          courses={trackingCourses}
          staffRows={trackingStaffRows}
        />
      ) : null}

      {tab === "manage" && canTrack ? (
        <TrainingManagePanel courses={manageCourses} canDelete={canDelete} />
      ) : null}

      {tab === "catalog" || !canTrack ? (
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
              <BookOpen className="h-5 w-5 text-[var(--brand)]" />
              Course catalog
            </h2>
            <label className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search courses…"
                aria-label="Search courses"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
              />
            </label>
          </div>
          {courses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              No courses for your departments yet. Company-wide courses (All
              staff) and any courses matching the departments checked on your
              People profile will show here.
            </p>
          ) : visibleCourses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              {searching
                ? `No courses match “${trimmedQuery}”.`
                : "No courses to show."}
            </p>
          ) : (
            <div className="space-y-6">
              {groupedCourses.map((group) => (
                <div key={group.label} className="space-y-3">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {group.label}
                    <span className="rounded-full bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                      {group.courses.length}
                    </span>
                  </h3>
                  <ul className="space-y-3">
                    {group.courses.map((course) => (
                      <CourseCard key={course.id} course={course} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <p className="text-sm text-[var(--muted)]">
        Looking for department tutorial videos?{" "}
        <Link
          href="/teams"
          className="font-medium text-[var(--brand)] hover:underline"
        >
          Open Teams
        </Link>
      </p>
    </div>
  );
}
