import {
  PACKET_STATUS_LABELS,
  type PacketStatus,
} from "@/lib/types/event-packets";

const STYLES: Record<PacketStatus, string> = {
  needs_completion:
    "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
  in_progress:
    "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100",
  completed:
    "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
};

export function PacketStatusBadge({ status }: { status: PacketStatus }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLES[status] ?? STYLES.needs_completion,
      ].join(" ")}
    >
      {PACKET_STATUS_LABELS[status] ?? status}
    </span>
  );
}
