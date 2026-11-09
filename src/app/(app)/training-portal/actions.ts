"use server";

import { getCurrentProfile } from "@/lib/auth/profile";
import { canViewTrainingCourse } from "@/lib/training/audience-access";
import { slugifyCourseTitle } from "@/lib/training/slug";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import type { TrainingCourseStatus } from "@/lib/types/training";
import { revalidatePath } from "next/cache";
import {
  HOW_TO_COURSE_SLUG,
  canWatchHowTo,
  howToVideoForSrc,
} from "@/lib/how-to/videos";

async function assertCanAccessCourseByLesson(
  profile: Profile,
  lessonId: string,
): Promise<{ error: string | null }> {
  if (profile.role === "admin" || profile.role === "trainer") {
    return { error: null };
  }

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("training_lessons")
    .select("course_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson?.course_id) return { error: "Lesson not found." };

  const { data: course } = await supabase
    .from("training_courses")
    .select("audience")
    .eq("id", lesson.course_id)
    .maybeSingle();

  if (
    course &&
    !canViewTrainingCourse(String(course.audience ?? "All staff"), {
      role: profile.role,
      departments: profile.departments ?? [],
    })
  ) {
    return { error: "This course is for another department." };
  }
  return { error: null };
}

function revalidateTraining(slug?: string) {
  revalidatePath("/training-portal");
  revalidatePath("/for-you");
  revalidatePath("/");
  if (slug) revalidatePath(`/training-portal/${slug}`);
}

async function requireCurriculumEditor() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { profile: null, error: "You must be signed in." as const };
  }
  if (profile.role !== "admin" && profile.role !== "trainer") {
    return {
      profile: null,
      error: "Only admins and trainers can manage curriculum." as const,
    };
  }
  return { profile, error: null as string | null };
}

const COURSE_STATUSES: TrainingCourseStatus[] = [
  "draft",
  "published",
  "coming_soon",
];

export async function markLessonCompleteAction(
  lessonId: string,
  courseSlug: string,
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in to track progress." };
  if (profile.role === "guest") {
    return { error: "Guest access is read-only." };
  }

  const id = lessonId.trim();
  if (!id) return { error: "Missing lesson." };

  const access = await assertCanAccessCourseByLesson(profile, id);
  if (access.error) return access;

  const supabase = await createClient();
  const { error } = await supabase.from("training_lesson_completions").upsert(
    {
      user_id: profile.id,
      lesson_id: id,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );

  if (error) {
    return { error: error.message };
  }

  try {
    const { maybeAwardCourseCompleted } = await import(
      "@/lib/points/earning"
    );
    await maybeAwardCourseCompleted(supabase, profile.id, courseSlug);
  } catch {
    // non-critical
  }

  revalidateTraining(courseSlug);
  return { error: null };
}

export async function markLessonIncompleteAction(
  lessonId: string,
  courseSlug: string,
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in to update progress." };
  if (profile.role === "guest") {
    return { error: "Guest access is read-only." };
  }

  const id = lessonId.trim();
  if (!id) return { error: "Missing lesson." };

  const access = await assertCanAccessCourseByLesson(profile, id);
  if (access.error) return access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_lesson_completions")
    .delete()
    .eq("user_id", profile.id)
    .eq("lesson_id", id);

  if (error) {
    return { error: error.message };
  }

  revalidateTraining(courseSlug);
  return { error: null };
}

export async function createCourseAction(input: {
  title: string;
  blurb: string;
  audience: string;
  status: TrainingCourseStatus;
}): Promise<{ error: string | null; slug?: string; id?: string }> {
  const { error: authError } = await requireCurriculumEditor();
  if (authError) return { error: authError };

  const title = input.title.trim();
  const blurb = input.blurb.trim();
  const audience = input.audience.trim() || "All staff";
  const status = input.status;
  if (!title) return { error: "Title is required." };
  if (!COURSE_STATUSES.includes(status)) {
    return { error: "Invalid course status." };
  }

  const supabase = await createClient();
  let slug = slugifyCourseTitle(title);
  const { data: existing } = await supabase
    .from("training_courses")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const { data: maxSort } = await supabase
    .from("training_courses")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("training_courses")
    .insert({
      slug,
      title,
      blurb,
      audience,
      status,
      sort_order: (maxSort?.sort_order ?? 0) + 10,
      updated_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single();

  if (error) return { error: error.message };
  revalidateTraining(slug);
  return { error: null, slug: data.slug, id: data.id };
}

export async function updateCourseAction(input: {
  id: string;
  title: string;
  blurb: string;
  audience: string;
  status: TrainingCourseStatus;
  slug: string;
}): Promise<{ error: string | null }> {
  const { error: authError } = await requireCurriculumEditor();
  if (authError) return { error: authError };

  const id = input.id.trim();
  const title = input.title.trim();
  const blurb = input.blurb.trim();
  const audience = input.audience.trim() || "All staff";
  const status = input.status;
  const slug = input.slug.trim();
  if (!id) return { error: "Missing course." };
  if (!title) return { error: "Title is required." };
  if (!COURSE_STATUSES.includes(status)) {
    return { error: "Invalid course status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_courses")
    .update({
      title,
      blurb,
      audience,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateTraining(slug);
  return { error: null };
}

export async function deleteCourseAction(
  courseId: string,
  slug: string,
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be signed in." };
  if (profile.role !== "admin") {
    return { error: "Only admins can delete courses." };
  }

  const id = courseId.trim();
  if (!id) return { error: "Missing course." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_courses")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateTraining(slug);
  return { error: null };
}

export async function createLessonAction(input: {
  courseId: string;
  courseSlug: string;
  title: string;
  body: string;
  resourceHref: string;
  resourceLabel: string;
}): Promise<{ error: string | null }> {
  const { error: authError } = await requireCurriculumEditor();
  if (authError) return { error: authError };

  const courseId = input.courseId.trim();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!courseId) return { error: "Missing course." };
  if (!title) return { error: "Lesson title is required." };

  const supabase = await createClient();
  const { data: maxSort } = await supabase
    .from("training_lessons")
    .select("sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("training_lessons").insert({
    course_id: courseId,
    title,
    body,
    resource_href: input.resourceHref.trim(),
    resource_label: input.resourceLabel.trim(),
    sort_order: (maxSort?.sort_order ?? 0) + 10,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };
  revalidateTraining(input.courseSlug);
  return { error: null };
}

export async function updateLessonAction(input: {
  lessonId: string;
  courseSlug: string;
  title: string;
  body: string;
  resourceHref: string;
  resourceLabel: string;
}): Promise<{ error: string | null }> {
  const { error: authError } = await requireCurriculumEditor();
  if (authError) return { error: authError };

  const lessonId = input.lessonId.trim();
  const title = input.title.trim();
  if (!lessonId) return { error: "Missing lesson." };
  if (!title) return { error: "Lesson title is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_lessons")
    .update({
      title,
      body: input.body.trim(),
      resource_href: input.resourceHref.trim(),
      resource_label: input.resourceLabel.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);

  if (error) return { error: error.message };
  revalidateTraining(input.courseSlug);
  return { error: null };
}

export async function deleteLessonAction(
  lessonId: string,
  courseSlug: string,
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be signed in." };
  if (profile.role !== "admin") {
    return { error: "Only admins can delete lessons." };
  }

  const id = lessonId.trim();
  if (!id) return { error: "Missing lesson." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_lessons")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidateTraining(courseSlug);
  return { error: null };
}

export async function moveLessonAction(input: {
  courseId: string;
  courseSlug: string;
  lessonId: string;
  direction: "up" | "down";
}): Promise<{ error: string | null }> {
  const { error: authError } = await requireCurriculumEditor();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const { data: lessons, error } = await supabase
    .from("training_lessons")
    .select("id, sort_order")
    .eq("course_id", input.courseId)
    .order("sort_order", { ascending: true });

  if (error) return { error: error.message };

  const list = lessons ?? [];
  const index = list.findIndex((row) => row.id === input.lessonId);
  if (index < 0) return { error: "Lesson not found." };

  const swapWith =
    input.direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) {
    return { error: null };
  }

  const a = list[index];
  const b = list[swapWith];
  const now = new Date().toISOString();

  const { error: errA } = await supabase
    .from("training_lessons")
    .update({ sort_order: b.sort_order, updated_at: now })
    .eq("id", a.id);
  if (errA) return { error: errA.message };

  const { error: errB } = await supabase
    .from("training_lessons")
    .update({ sort_order: a.sort_order, updated_at: now })
    .eq("id", b.id);
  if (errB) return { error: errB.message };

  revalidateTraining(input.courseSlug);
  return { error: null };
}

// ---- Quizzes ------------------------------------------------------------

export async function submitQuizAction(input: {
  lessonId: string;
  courseSlug: string;
  answers: Record<string, number>;
}): Promise<{
  error: string | null;
  result?: { total: number; correct: number; passed: boolean };
}> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in to take the quiz." };
  if (profile.role === "guest") return { error: "Guest access is read-only." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_grade_lesson", {
    p_lesson_id: input.lessonId,
    p_answers: input.answers,
  });
  if (error) return { error: error.message };

  const r = (data ?? {}) as {
    total?: number;
    correct?: number;
    passed?: boolean;
    error?: string;
  };
  if (r.error === "no_questions") {
    return { error: "This lesson doesn’t have a quiz yet." };
  }
  if (r.passed) {
    try {
      const { maybeAwardCourseCompleted } = await import(
        "@/lib/points/earning"
      );
      await maybeAwardCourseCompleted(supabase, profile.id, input.courseSlug);
    } catch {
      // non-critical
    }
    revalidateTraining(input.courseSlug);
  }
  return {
    error: null,
    result: {
      total: r.total ?? 0,
      correct: r.correct ?? 0,
      passed: Boolean(r.passed),
    },
  };
}

export async function createQuestionAction(input: {
  lessonId: string;
  courseSlug: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}): Promise<{ error: string | null }> {
  const { error: authError } = await requireCurriculumEditor();
  if (authError) return { error: authError };

  const prompt = input.prompt.trim();
  const choices = input.choices.map((c) => c.trim()).filter(Boolean);
  if (!prompt) return { error: "Question text is required." };
  if (choices.length < 2) return { error: "Add at least two answer choices." };
  const correctIndex = Math.max(
    0,
    Math.min(input.correctIndex, choices.length - 1),
  );

  const supabase = await createClient();
  const { data: maxSort } = await supabase
    .from("training_questions")
    .select("sort_order")
    .eq("lesson_id", input.lessonId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("training_questions").insert({
    lesson_id: input.lessonId,
    prompt,
    choices,
    correct_index: correctIndex,
    sort_order: (maxSort?.sort_order ?? 0) + 10,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidateTraining(input.courseSlug);
  return { error: null };
}

export async function deleteQuestionAction(
  questionId: string,
  courseSlug: string,
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "You must be signed in." };
  if (profile.role !== "admin") {
    return { error: "Only admins can delete quiz questions." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_questions")
    .delete()
    .eq("id", questionId.trim());
  if (error) return { error: error.message };

  revalidateTraining(courseSlug);
  return { error: null };
}

/** Called by the how-to player once 90% of a video has actually played. */
export async function completeHowToLessonAction(
  lessonId: string,
  courseSlug: string,
): Promise<{ error: string | null }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sign in to track progress." };
  if (profile.role === "guest") {
    return { error: "Guest access is read-only." };
  }
  if (courseSlug !== HOW_TO_COURSE_SLUG) {
    return { error: "Not a how-to course." };
  }

  const id = lessonId.trim();
  if (!id) return { error: "Missing lesson." };

  const access = await assertCanAccessCourseByLesson(profile, id);
  if (access.error) return access;

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("training_lessons")
    .select("resource_href")
    .eq("id", id)
    .maybeSingle();
  const video = lesson ? howToVideoForSrc(String(lesson.resource_href)) : null;
  if (!video || !canWatchHowTo(video, profile)) {
    return { error: "You can’t open this video." };
  }

  const { error } = await supabase.from("training_lesson_completions").upsert(
    {
      user_id: profile.id,
      lesson_id: id,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) return { error: error.message };

  try {
    const { awardHowToVideoWatched } = await import("@/lib/points/earning");
    await awardHowToVideoWatched(supabase, profile, id);
  } catch {
    // non-critical
  }

  revalidateTraining(courseSlug);
  return { error: null };
}
