import { TrainingPortalClient } from "@/components/training/training-portal-client";
import { isGuestRole } from "@/lib/auth/guest";
import { getCurrentProfile } from "@/lib/auth/profile";
import {
  courseProgress,
  publishedCourseProgress,
} from "@/lib/training/progress";
import { filterCoursesForViewer } from "@/lib/training/audience-access";
import { HOW_TO_COURSE_SLUG, filterHowToLessons } from "@/lib/how-to/videos";
import { createClient } from "@/lib/supabase/server";
import type {
  TrainingCourse,
  TrainingCourseStatus,
  TrainingLesson,
} from "@/lib/types/training";
import { redirect } from "next/navigation";

export default async function TrainingPortalPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const guest = isGuestRole(profile.role);
  const canTrack =
    !guest && (profile.role === "admin" || profile.role === "trainer");
  const canDelete = !guest && profile.role === "admin";

  const { data: courseRows, error } = await supabase
    .from("training_courses")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Training Portal needs a database update</p>
        <p className="mt-2">
          Run migration <code>034_training_courses.sql</code> in Supabase, then
          refresh. ({error.message})
        </p>
      </div>
    );
  }

  const allCourses = (courseRows ?? []) as TrainingCourse[];
  // Staff/guests: only All staff + courses for departments checked on People.
  // Admins and trainers: full catalog (Manage / Tracking stay complete).
  const courses = canTrack
    ? allCourses
    : filterCoursesForViewer(allCourses, {
        role: profile.role,
        departments: profile.departments ?? [],
      });
  const courseIds = courses.map((course) => course.id);

  const { data: lessonRows } = courseIds.length
    ? await supabase
        .from("training_lessons")
        .select(
          "id, course_id, sort_order, title, body, resource_href, resource_label, created_at, updated_at",
        )
        .in("course_id", courseIds)
        .order("sort_order", { ascending: true })
    : { data: [] as TrainingLesson[] };

  const courseSlugById = new Map(courses.map((c) => [c.id, c.slug]));
  const lessonsByCourse = new Map<string, string[]>();
  const fullLessonsByCourse = new Map<string, TrainingLesson[]>();
  for (const row of (lessonRows ?? []) as TrainingLesson[]) {
    if (
      courseSlugById.get(row.course_id) === HOW_TO_COURSE_SLUG &&
      filterHowToLessons([row], {
        role: profile.role,
        departments: profile.departments ?? [],
      }).length === 0
    ) {
      continue;
    }
    const list = lessonsByCourse.get(row.course_id) ?? [];
    list.push(row.id);
    lessonsByCourse.set(row.course_id, list);
    if (canTrack) {
      const full = fullLessonsByCourse.get(row.course_id) ?? [];
      full.push(row);
      fullLessonsByCourse.set(row.course_id, full);
    }
  }

  const manageCourses = canTrack
    ? courses.map((course) => ({
        ...course,
        lessons: fullLessonsByCourse.get(course.id) ?? [],
      }))
    : [];

  const allLessonIds = (lessonRows ?? []).map((row) => row.id);
  const { data: myCompletionRows } =
    !guest && allLessonIds.length
      ? await supabase
          .from("training_lesson_completions")
          .select("lesson_id")
          .eq("user_id", profile.id)
          .in("lesson_id", allLessonIds)
      : { data: [] as { lesson_id: string }[] };

  const myCompletedLessonIds = new Set(
    (myCompletionRows ?? []).map((row) => row.lesson_id),
  );

  const catalog = courses.map((course) => {
    const lessonIds = lessonsByCourse.get(course.id) ?? [];
    const completed = lessonIds.filter((id) =>
      myCompletedLessonIds.has(id),
    ).length;
    return {
      ...course,
      status: course.status as TrainingCourseStatus,
      lessonCount: lessonIds.length,
      progress: courseProgress(course.status, lessonIds.length, completed),
    };
  });

  const inProgressCount = catalog.filter(
    (course) => course.progress.status === "in_progress",
  ).length;
  const completedCount = catalog.filter(
    (course) => course.progress.status === "completed",
  ).length;

  const { count: lifetimeLessonCompletions } =
    !guest
      ? await supabase
          .from("training_lesson_completions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
      : { count: 0 };

  const publishedCourses = courses.filter(
    (course) => course.status === "published",
  );
  const trackingCourses = publishedCourses.map((course) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    lessonCount: (lessonsByCourse.get(course.id) ?? []).length,
  }));

  let trackingStaffRows: {
    userId: string;
    name: string;
    byCourse: Record<
      string,
      { completedLessons: number; progress: ReturnType<typeof courseProgress> }
    >;
  }[] = [];

  if (canTrack && trackingCourses.length > 0) {
    const { data: staffRows } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    const publishedLessonIds = publishedCourses.flatMap(
      (course) => lessonsByCourse.get(course.id) ?? [],
    );

    const { data: allCompletions } = publishedLessonIds.length
      ? await supabase
          .from("training_lesson_completions")
          .select("user_id, lesson_id")
          .in("lesson_id", publishedLessonIds)
      : { data: [] as { user_id: string; lesson_id: string }[] };

    const completedByUser = new Map<string, Set<string>>();
    for (const row of allCompletions ?? []) {
      const set = completedByUser.get(row.user_id) ?? new Set<string>();
      set.add(row.lesson_id);
      completedByUser.set(row.user_id, set);
    }

    trackingStaffRows = (staffRows ?? []).map((staff) => {
      const done = completedByUser.get(staff.id as string) ?? new Set<string>();
      const byCourse: (typeof trackingStaffRows)[number]["byCourse"] = {};
      for (const course of trackingCourses) {
        const lessonIds = lessonsByCourse.get(course.id) ?? [];
        const completedLessons = lessonIds.filter((id) => done.has(id)).length;
        byCourse[course.id] = {
          completedLessons,
          progress: publishedCourseProgress(
            course.lessonCount,
            completedLessons,
          ),
        };
      }
      return {
        userId: staff.id as string,
        name: String(staff.full_name || staff.email || "Staff"),
        byCourse,
      };
    });
  }

  return (
    <TrainingPortalClient
      courses={catalog}
      inProgressCount={inProgressCount}
      completedCount={completedCount}
      canTrack={canTrack}
      canDelete={canDelete}
      trackingCourses={trackingCourses}
      trackingStaffRows={trackingStaffRows}
      manageCourses={manageCourses}
    />
  );
}
