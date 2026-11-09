import type { CourseProgress, TrainingCourseStatus } from "@/lib/types/training";

export function courseProgress(
  status: TrainingCourseStatus,
  totalLessons: number,
  completedLessons: number,
): CourseProgress {
  if (status === "coming_soon" || status === "draft") {
    return {
      totalLessons,
      completedLessons: 0,
      status: "locked",
    };
  }

  if (totalLessons === 0) {
    return {
      totalLessons: 0,
      completedLessons: 0,
      status: "not_started",
    };
  }

  if (completedLessons <= 0) {
    return {
      totalLessons,
      completedLessons: 0,
      status: "not_started",
    };
  }

  if (completedLessons >= totalLessons) {
    return {
      totalLessons,
      completedLessons: totalLessons,
      status: "completed",
    };
  }

  return {
    totalLessons,
    completedLessons,
    status: "in_progress",
  };
}

export function progressLabel(progress: CourseProgress): string {
  switch (progress.status) {
    case "locked":
      return "Locked";
    case "completed":
      return "Completed";
    case "in_progress":
      return `${progress.completedLessons}/${progress.totalLessons} lessons`;
    default:
      return "Not started";
  }
}

/** Progress for a published course given completion counts. */
export function publishedCourseProgress(
  lessonCount: number,
  completedLessons: number,
): CourseProgress {
  return courseProgress("published", lessonCount, completedLessons);
}
