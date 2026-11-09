import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { setChangelogVideoStatusAction } from "../actions";
import {
  audienceLabel,
  canSeeChangelogVideo,
  type ChangelogVideo,
} from "@/lib/changelog-videos/visibility";

export const metadata = { title: "Change Log Videos" };
export const dynamic = "force-dynamic";

type VideoRun = {
  id: string;
  check_date: string;
  since_date: string | null;
  entries_found: number;
  status: "no_changes" | "video_owed" | "video_published";
  note: string;
};

const RUN_LABEL: Record<VideoRun["status"], string> = {
  no_changes: "No changes",
  video_owed: "Video owed",
  video_published: "Video published",
};

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function VideoCard({
  video,
  isAdmin,
}: {
  video: ChangelogVideo;
  isAdmin: boolean;
}) {
  const hidden = video.status === "superseded";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {video.title}
            {audienceLabel(video.audience) ? (
              <span className="ml-2 rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
                {audienceLabel(video.audience)}
              </span>
            ) : null}
          </h3>
          <p className="text-xs text-[var(--muted)]">
            {fmtDate(video.period_start)} – {fmtDate(video.period_end)}
            {hidden ? " · Hidden from staff" : ""}
          </p>
        </div>
        {isAdmin ? (
          <form action={setChangelogVideoStatusAction}>
            <input type="hidden" name="id" value={video.id} />
            <input
              type="hidden"
              name="status"
              value={hidden ? "live" : "superseded"}
            />
            <button
              type="submit"
              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            >
              {hidden ? "Restore" : "Hide from staff"}
            </button>
          </form>
        ) : null}
      </div>
      {video.summary ? (
        <p className="mt-2 text-sm text-[var(--foreground)]/90">{video.summary}</p>
      ) : null}
      <video
        controls
        playsInline
        preload="metadata"
        src={video.src}
        aria-label={video.title}
        className="mt-3 aspect-video w-full rounded-xl bg-black"
      />
    </div>
  );
}

export default async function ChangelogVideosPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "guest") redirect("/");

  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("changelog_videos")
    .select(
      "id, title, kind, audience, period_start, period_end, src, topic_keys, summary, status, superseded_by, created_at",
    )
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">Couldn’t load this section</p>
        <p className="mt-2">Please refresh the page and try again.</p>
      </div>
    );
  }

  const all = ((rows ?? []) as ChangelogVideo[]).filter((v) =>
    canSeeChangelogVideo(v, profile),
  );
  const current = all.filter((v) => v.status === "live");
  const hidden = isAdmin ? all.filter((v) => v.status === "superseded") : [];

  let runs: VideoRun[] = [];
  if (isAdmin) {
    const { data: runRows } = await supabase
      .from("changelog_video_runs")
      .select("id, check_date, since_date, entries_found, status, note")
      .order("check_date", { ascending: false })
      .limit(26);
    runs = (runRows ?? []) as VideoRun[];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <Link
          href="/changelog"
          className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Back to What&rsquo;s New
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
          Change Log Videos
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Short videos on what changed in the Hub, newest first. The same
          video also sits above its month on What&rsquo;s New.
        </p>
      </header>

      {current.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-sm text-[var(--muted)]">
            No videos yet — check back after the next update.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {current.map((v) => (
            <VideoCard key={v.id} video={v} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {hidden.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            Hidden from staff (admins only)
          </h2>
          <div className="space-y-4">
            {hidden.map((v) => (
              <VideoCard key={v.id} video={v} isAdmin={isAdmin} />
            ))}
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            Weekly checks (admins only)
          </h2>
          {runs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No checks logged yet.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-hover)] text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Checked</th>
                    <th className="px-3 py-2 font-medium">Since</th>
                    <th className="px-3 py-2 font-medium">Entries</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">{fmtDate(r.check_date)}</td>
                      <td className="px-3 py-2">
                        {r.since_date ? fmtDate(r.since_date) : "—"}
                      </td>
                      <td className="px-3 py-2">{r.entries_found}</td>
                      <td className="px-3 py-2" title={r.note}>
                        {RUN_LABEL[r.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
