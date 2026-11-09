import { CourseDetailClient } from "@/components/training/course-detail-client";
import { isGuestRole } from "@/lib/auth/guest";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canViewTrainingCourse } from "@/lib/training/audience-access";
import { courseProgress } from "@/lib/training/progress";
import { HOW_TO_COURSE_SLUG, filterHowToLessons } from "@/lib/how-to/videos";
import { createClient } from "@/lib/supabase/server";
import type {
  TrainingCourse,
  TrainingLesson,
  TrainingQuestion,
} from "@/lib/types/training";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type CoursePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TrainingCoursePage({ params }: CoursePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { slug } = await params;
  const supabase = await createClient();

  const { data: courseRow, error } = await supabase
    .from("training_courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

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

  if (!courseRow) notFound();

  const course = courseRow as TrainingCourse;

  if (
    !canViewTrainingCourse(course.audience, {
      role: profile.role,
      departments: profile.departments ?? [],
    })
  ) {
    redirect("/training-portal");
  }

  if (course.status === "coming_soon") {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="font-semibold text-[var(--foreground)]">
          {course.title} is coming soon
        </p>
        <p className="text-sm text-[var(--muted)]">
          Lessons are not open yet. Check Teams for department tutorial videos
          in the meantime.
        </p>
        <Link
          href="/training-portal"
          className="inline-flex text-sm font-medium text-[var(--brand)] hover:underline"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  const guest = isGuestRole(profile.role);
  if (
    course.status === "draft" &&
    (profile.role === "staff" || guest)
  ) {
    notFound();
  }

  const { data: lessonRows } = await supabase
    .from("training_lessons")
    .select("*")
    .eq("course_id", course.id)
    .order("sort_order", { ascending: true });

  const allLessons = (lessonRows ?? []) as TrainingLesson[];
  // How-to course: only lessons for modules this person can open.
  const lessons =
    course.slug === HOW_TO_COURSE_SLUG
      ? filterHowToLessons(allLessons, {
          role: profile.role,
          departments: profile.departments ?? [],
        })
      : allLessons;
  const lessonIds = lessons.map((lesson) => lesson.id);

  const { data: completionRows } =
    !guest && lessonIds.length
      ? await supabase
          .from("training_lesson_completions")
          .select("lesson_id")
          .eq("user_id", profile.id)
          .in("lesson_id", lessonIds)
      : { data: [] as { lesson_id: string }[] };

  const completedLessonIds = (completionRows ?? []).map(
    (row) => row.lesson_id as string,
  );
  const progress = courseProgress(
    course.status,
    lessons.length,
    completedLessonIds.length,
  );

  let lifetimeLessonCompletions = 0;
  let completedPublishedCourses = progress.status === "completed" ? 1 : 0;

  if (!guest) {
    const { count } = await supabase
      .from("training_lesson_completions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id);
    lifetimeLessonCompletions = count ?? 0;

    if (completedPublishedCourses === 0) {
      const { data: published } = await supabase
        .from("training_courses")
        .select("id")
        .eq("status", "published");
      const publishedIds = (published ?? []).map((row) => row.id as string);
      if (publishedIds.length) {
        const { data: pubLessons } = await supabase
          .from("training_lessons")
          .select("id, course_id")
          .in("course_id", publishedIds);
        const { data: allCompletions } = await supabase
          .from("training_lesson_completions")
          .select("lesson_id")
          .eq("user_id", profile.id);
        const done = new Set(
          (allCompletions ?? []).map((row) => row.lesson_id as string),
        );
        const byCourse = new Map<string, string[]>();
        for (const lesson of pubLessons ?? []) {
          const list = byCourse.get(lesson.course_id) ?? [];
          list.push(lesson.id);
          byCourse.set(lesson.course_id, list);
        }
        completedPublishedCourses = [...byCourse.values()].filter(
          (ids) => ids.length > 0 && ids.every((id) => done.has(id)),
        ).length;
      }
    }
  }

  // Quiz questions. Learners never receive the correct answer; admins/trainers do.
  const canManage = profile.role === "admin" || profile.role === "trainer";
  const isAdmin = profile.role === "admin";
  const questionColumns = canManage
    ? "id, lesson_id, prompt, choices, sort_order, correct_index"
    : "id, lesson_id, prompt, choices, sort_order";

  const { data: questionRows } = lessonIds.length
    ? await supabase
        .from("training_questions")
        .select(questionColumns)
        .in("lesson_id", lessonIds)
        .order("sort_order", { ascending: true })
    : { data: [] as TrainingQuestion[] };

  const questionsByLesson: Record<string, TrainingQuestion[]> = {};
  for (const row of (questionRows ?? []) as TrainingQuestion[]) {
    (questionsByLesson[row.lesson_id] ??= []).push(row);
  }

  return (
    <CourseDetailClient
      course={course}
      lessons={lessons}
      completedLessonIds={completedLessonIds}
      progress={progress}
      readOnly={guest}
      questionsByLesson={questionsByLesson}
      canManage={canManage}
      isAdmin={isAdmin}
    />
  );
}
