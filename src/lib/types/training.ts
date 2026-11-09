export type TrainingCourseStatus = "draft" | "published" | "coming_soon";

export type TrainingCourse = {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  audience: string;
  status: TrainingCourseStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TrainingLesson = {
  id: string;
  course_id: string;
  sort_order: number;
  title: string;
  body: string;
  resource_href: string;
  resource_label: string;
  created_at: string;
  updated_at: string;
};

export type TrainingQuestion = {
  id: string;
  lesson_id: string;
  prompt: string;
  choices: string[];
  sort_order: number;
  /** Present only for admins/trainers (managers). Never sent to learners. */
  correct_index?: number;
};

export type CourseProgress = {
  totalLessons: number;
  completedLessons: number;
  status: "not_started" | "in_progress" | "completed" | "locked";
};

export const COURSE_STATUS_LABELS: Record<TrainingCourseStatus, string> = {
  draft: "Draft",
  published: "Available",
  coming_soon: "Coming soon",
};
