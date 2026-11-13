import { pipelineSourceBadge } from "@/lib/pipeline/source-badge";

/**
 * "Hub" or "Website" after a project's name (nothing for projects synced from Pipeline).
 * `className` is layout only (margin, padding, size); the badge sets its own colors.
 */
export function PipelineSourceBadge({
  sourceEvent,
  className,
}: {
  sourceEvent: string | null | undefined;
  className: string;
}) {
  const badge = pipelineSourceBadge(sourceEvent);
  if (!badge) return null;
  return (
    <span className={`${className} ${badge.colors}`} title={badge.title}>
      {badge.label}
    </span>
  );
}
