"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
} from "lucide-react";
import {
  markLessonCompleteAction,
  markLessonIncompleteAction,
} from "@/app/(app)/training-portal/actions";
import { LessonQuiz } from "@/components/training/lesson-quiz";
import { HowToLessonPlayer } from "@/components/training/how-to-lesson-player";
import { isHowToLesson } from "@/lib/how-to/videos";
import { progressLabel } from "@/lib/training/progress";
import type {
  CourseProgress,
  TrainingCourse,
  TrainingLesson,
  TrainingQuestion,
} from "@/lib/types/training";

type CourseDetailClientProps = {
  course: TrainingCourse;
  lessons: TrainingLesson[];
  completedLessonIds: string[];
  progress: CourseProgress;
  readOnly?: boolean;
  questionsByLesson?: Record<string, TrainingQuestion[]>;
  canManage?: boolean;
  isAdmin?: boolean;
};

export function CourseDetailClient({
  course,
  lessons,
  completedLessonIds,
  progress,
  readOnly = false,
  questionsByLesson = {},
  canManage = false,
  isAdmin = false,
}: CourseDetailClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(
    lessons.find((lesson) => !completedLessonIds.includes(lesson.id))?.id ??
      lessons[0]?.id ??
      null,
  );
  const [error, setError] = useState<string | null>(null);
  const completedSet = new Set(completedLessonIds);

  function toggleComplete(lessonId: string, done: boolean) {
    setError(null);
    startTransition(async () => {
      const result = done
        ? await markLessonIncompleteAction(lessonId, course.slug)
        : await markLessonCompleteAction(lessonId, course.slug);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/training-portal"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          All courses
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
          {course.audience}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          {course.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{course.blurb}</p>
        <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
          {progressLabel(progress)}
          {progress.totalLessons > 0
            ? ` · ${progress.completedLessons} of ${progress.totalLessons} complete`
            : null}
        </p>
        {progress.totalLessons > 0 ? (
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-300"
              style={{
                width: `${Math.round(
                  (progress.completedLessons / progress.totalLessons) * 100,
                )}%`,
              }}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}

      {lessons.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          Lessons for this course are not published yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {lessons.map((lesson, index) => {
            const done = completedSet.has(lesson.id);
            const open = openId === lesson.id;
            const qs = questionsByLesson[lesson.id] ?? [];
            const howTo = isHowToLesson(course.slug, lesson);
            return (
              <li
                key={lesson.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : lesson.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--surface-hover)]"
                >
                  <span className="mt-0.5 text-[var(--muted)]">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-[var(--brand)]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Lesson {index + 1}
                    </span>
                    <span className="mt-0.5 block font-medium text-[var(--foreground)]">
                      {lesson.title}
                    </span>
                  </span>
                </button>

                {open ? (
                  <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                      {lesson.body}
                    </div>
                    {howTo ? (
                      <HowToLessonPlayer
                        lessonId={lesson.id}
                        courseSlug={course.slug}
                        src={lesson.resource_href}
                        done={done}
                        readOnly={readOnly}
                      />
                    ) : null}
                    {lesson.resource_href && !howTo ? (
                      <Link
                        href={lesson.resource_href}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
                      >
                        {lesson.resource_label || "Open related Hub page"}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                    {qs.length === 0 && !readOnly && !howTo ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => toggleComplete(lesson.id, done)}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50",
                          done
                            ? "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                            : "bg-[var(--brand)] text-white hover:opacity-90",
                        ].join(" ")}
                      >
                        {done ? "Mark incomplete" : "Mark complete"}
                      </button>
                    ) : null}
                    {readOnly ? (
                      <p className="text-xs text-[var(--muted)]">
                        Guest access is read-only — progress isn’t saved.
                      </p>
                    ) : null}
                    <LessonQuiz
                      lessonId={lesson.id}
                      courseSlug={course.slug}
                      questions={qs}
                      canManage={canManage}
                      isAdmin={isAdmin}
                      done={done}
                      readOnly={readOnly}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
