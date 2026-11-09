"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createCourseAction,
  createLessonAction,
  deleteCourseAction,
  deleteLessonAction,
  moveLessonAction,
  updateCourseAction,
  updateLessonAction,
} from "@/app/(app)/training-portal/actions";
import { TRAINING_AUDIENCE_OPTIONS } from "@/lib/training/audience-access";
import {
  COURSE_STATUS_LABELS,
  type TrainingCourse,
  type TrainingCourseStatus,
  type TrainingLesson,
} from "@/lib/types/training";

export type ManageCourse = TrainingCourse & {
  lessons: TrainingLesson[];
};

type TrainingManagePanelProps = {
  courses: ManageCourse[];
  canDelete: boolean;
};

const STATUSES: TrainingCourseStatus[] = [
  "published",
  "coming_soon",
  "draft",
];

export function TrainingManagePanel({
  courses,
  canDelete,
}: TrainingManagePanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(
    courses[0]?.id ?? "",
  );
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const selected = useMemo(
    () => courses.find((course) => course.id === selectedId) ?? null,
    [courses, selectedId],
  );

  function run(action: () => Promise<{ error: string | null }>, ok: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(ok);
      setEditingLessonId(null);
      router.refresh();
    });
  }

  function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formEl = event.currentTarget;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await createCourseAction({
        title: String(form.get("title") ?? ""),
        blurb: String(form.get("blurb") ?? ""),
        audience: String(form.get("audience") ?? "All staff"),
        status: String(form.get("status") ?? "coming_soon") as TrainingCourseStatus,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.id) setSelectedId(result.id);
      setMessage("Course created.");
      formEl.reset();
      router.refresh();
    });
  }

  function handleSaveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    run(
      () =>
        updateCourseAction({
          id: selected.id,
          slug: selected.slug,
          title: String(form.get("title") ?? ""),
          blurb: String(form.get("blurb") ?? ""),
          audience: String(form.get("audience") ?? "All staff"),
          status: String(form.get("status") ?? selected.status) as TrainingCourseStatus,
        }),
      "Course saved.",
    );
  }

  function handleAddLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    run(
      () =>
        createLessonAction({
          courseId: selected.id,
          courseSlug: selected.slug,
          title: String(form.get("title") ?? ""),
          body: String(form.get("body") ?? ""),
          resourceHref: String(form.get("resource_href") ?? ""),
          resourceLabel: String(form.get("resource_label") ?? ""),
        }),
      "Lesson added.",
    );
    event.currentTarget.reset();
  }

  function handleSaveLesson(
    event: FormEvent<HTMLFormElement>,
    lesson: TrainingLesson,
  ) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    run(
      () =>
        updateLessonAction({
          lessonId: lesson.id,
          courseSlug: selected.slug,
          title: String(form.get("title") ?? ""),
          body: String(form.get("body") ?? ""),
          resourceHref: String(form.get("resource_href") ?? ""),
          resourceLabel: String(form.get("resource_label") ?? ""),
        }),
      "Lesson saved.",
    );
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]";
  const labelClass = "block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Manage curriculum
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Edit courses and lessons in the Hub. Set status to Available when a
          course is ready for staff.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {message}
        </p>
      ) : null}

      <form
        onSubmit={handleCreateCourse}
        className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <p className="text-sm font-semibold text-[var(--foreground)]">
          New course
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Title</span>
            <input name="title" required className={fieldClass} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Blurb</span>
            <input name="blurb" className={fieldClass} />
          </label>
          <label>
            <span className={labelClass}>Audience (department)</span>
            <select
              name="audience"
              defaultValue="All staff"
              className={fieldClass}
            >
              {TRAINING_AUDIENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Status</span>
            <select
              name="status"
              defaultValue="coming_soon"
              className={fieldClass}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {COURSE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Create course
        </button>
      </form>

      {courses.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No courses yet.</p>
      ) : (
        <>
          <label className="block">
            <span className={labelClass}>Edit course</span>
            <select
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setEditingLessonId(null);
              }}
              className={fieldClass}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title} · {COURSE_STATUS_LABELS[course.status]}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div className="space-y-5">
              <form
                key={selected.id}
                onSubmit={handleSaveCourse}
                className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Title</span>
                    <input
                      name="title"
                      required
                      defaultValue={selected.title}
                      className={fieldClass}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClass}>Blurb</span>
                    <textarea
                      name="blurb"
                      rows={2}
                      defaultValue={selected.blurb}
                      className={fieldClass}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Audience (department)</span>
                    <select
                      name="audience"
                      defaultValue={
                        (TRAINING_AUDIENCE_OPTIONS as readonly string[]).includes(
                          selected.audience,
                        )
                          ? selected.audience
                          : "All staff"
                      }
                      className={fieldClass}
                    >
                      {!(TRAINING_AUDIENCE_OPTIONS as readonly string[]).includes(
                        selected.audience,
                      ) ? (
                        <option value={selected.audience}>
                          {selected.audience}
                        </option>
                      ) : null}
                      {TRAINING_AUDIENCE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={labelClass}>Status</span>
                    <select
                      name="status"
                      defaultValue={selected.status}
                      className={fieldClass}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {COURSE_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Slug: <code>{selected.slug}</code> (stable URL; not edited
                  here)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Save course
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete “${selected.title}” and all its lessons?`,
                          )
                        ) {
                          return;
                        }
                        run(
                          () =>
                            deleteCourseAction(selected.id, selected.slug),
                          "Course deleted.",
                        );
                        setSelectedId("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete course
                    </button>
                  ) : null}
                </div>
              </form>

              <section className="space-y-3">
                <h3 className="font-semibold text-[var(--foreground)]">
                  Lessons ({selected.lessons.length})
                </h3>
                <ul className="space-y-2">
                  {selected.lessons.map((lesson, index) => {
                    const open = editingLessonId === lesson.id;
                    return (
                      <li
                        key={lesson.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={pending || index === 0}
                              onClick={() =>
                                run(
                                  () =>
                                    moveLessonAction({
                                      courseId: selected.id,
                                      courseSlug: selected.slug,
                                      lessonId: lesson.id,
                                      direction: "up",
                                    }),
                                  "Lesson moved.",
                                )
                              }
                              className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
                              aria-label="Move lesson up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={
                                pending ||
                                index === selected.lessons.length - 1
                              }
                              onClick={() =>
                                run(
                                  () =>
                                    moveLessonAction({
                                      courseId: selected.id,
                                      courseSlug: selected.slug,
                                      lessonId: lesson.id,
                                      direction: "down",
                                    }),
                                  "Lesson moved.",
                                )
                              }
                              className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
                              aria-label="Move lesson down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingLessonId(open ? null : lesson.id)
                            }
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block text-xs text-[var(--muted)]">
                              Lesson {index + 1}
                            </span>
                            <span className="font-medium text-[var(--foreground)]">
                              {lesson.title}
                            </span>
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Delete lesson “${lesson.title}”?`,
                                  )
                                ) {
                                  return;
                                }
                                run(
                                  () =>
                                    deleteLessonAction(
                                      lesson.id,
                                      selected.slug,
                                    ),
                                  "Lesson deleted.",
                                );
                              }}
                              className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-red-600 disabled:opacity-50"
                              aria-label="Delete lesson"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        {open ? (
                          <form
                            onSubmit={(event) =>
                              handleSaveLesson(event, lesson)
                            }
                            className="space-y-3 border-t border-[var(--border)] px-3 py-3"
                          >
                            <label className="block">
                              <span className={labelClass}>Title</span>
                              <input
                                name="title"
                                required
                                defaultValue={lesson.title}
                                className={fieldClass}
                              />
                            </label>
                            <label className="block">
                              <span className={labelClass}>Body</span>
                              <textarea
                                name="body"
                                rows={8}
                                defaultValue={lesson.body}
                                className={fieldClass}
                              />
                            </label>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label>
                                <span className={labelClass}>
                                  Hub link (optional)
                                </span>
                                <input
                                  name="resource_href"
                                  placeholder="/teams"
                                  defaultValue={lesson.resource_href}
                                  className={fieldClass}
                                />
                              </label>
                              <label>
                                <span className={labelClass}>Link label</span>
                                <input
                                  name="resource_label"
                                  placeholder="Open Teams"
                                  defaultValue={lesson.resource_label}
                                  className={fieldClass}
                                />
                              </label>
                            </div>
                            <button
                              type="submit"
                              disabled={pending}
                              className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              Save lesson
                            </button>
                          </form>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <form
                  onSubmit={handleAddLesson}
                  className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Add lesson
                  </p>
                  <label className="block">
                    <span className={labelClass}>Title</span>
                    <input name="title" required className={fieldClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Body</span>
                    <textarea name="body" rows={5} className={fieldClass} />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className={labelClass}>Hub link (optional)</span>
                      <input
                        name="resource_href"
                        placeholder="/event-packets"
                        className={fieldClass}
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Link label</span>
                      <input
                        name="resource_label"
                        placeholder="Open Event Packets"
                        className={fieldClass}
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add lesson
                  </button>
                </form>
              </section>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
