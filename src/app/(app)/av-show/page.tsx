import { ExternalLink, Layers, MonitorPlay, Timer } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canAccessVidentAv } from "@/lib/vident-av-access";

export const metadata = { title: "AV Show Control" };
export const dynamic = "force-dynamic";

const OUTPUTS = [
  {
    icon: MonitorPlay,
    title: "Full screen",
    body: "Branded text slides, sponsor loop and slideshow. Send this window to the stage TVs or projector.",
  },
  {
    icon: Layers,
    title: "Lower third (green)",
    body: "Names, titles and announcements on a solid green screen. Key the green over your camera feed on the video mixer.",
  },
  {
    icon: Timer,
    title: "Stage timer",
    body: "Countdown, time of day and quick messages for the presenter's confidence monitor.",
  },
];

const STEPS = [
  "Click Launch AV Show Control. It opens in its own window.",
  "Build your run of show, or import a speaker list (CSV) to create a lower third for every speaker. Add sponsors and any backgrounds.",
  "Click each Open output button, drag each window to its display, then double-click it for full screen.",
  "Click Open all three (or each Open output), drag windows to displays, then double-click for full screen.",
  "Optional: Start Hub remote, note the PIN, open /av-show/remote on a phone (or Stream Deck → /api/av-show/cmd). Extend the session before a long show.",
  "Press T for test patterns and set the green chroma key on the video mixer.",
  "Run the show: click an item, then press Space to take it live. X is the panic blackout.",
  "Export the show file when you finish, so the next event starts from this one.",
];

export default async function AvShowPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (!canAccessVidentAv(profile)) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          AV Show Control
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
          Access restricted
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          AV Show Control is only available to admins and team members assigned
          to the Audiovisual department. Ask an admin to update your profile if you need
          access.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          AV Show Control
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
          Run the screens for a live show
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          One control page drives the full-screen graphics, the green lower
          thirds and the stage timer. Click an item and it goes up on the right
          screens. Open all three output windows while you are online. Once they are open, the show keeps running if the venue internet drops.
        </p>
        <a
          href="/av-show/index.html"
          target="_blank"
          rel="noopener"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          Launch AV Show Control
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {OUTPUTS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
          >
            <Icon className="h-5 w-5 text-[var(--brand)]" aria-hidden />
            <h2 className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
          Show-day steps
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--muted)]">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
          Hotkeys
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Space take staged item · Arrow keys change the staged item · Esc clear
          lower third · B back to logo · X panic blackout · T test patterns · S
          sponsor loop · L slideshow
        </p>
        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
          Good to know
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
          <li>
            Keep the control page and the three output windows in the same
            Chrome window group on one computer.
          </li>
          <li>
            Shows, logos and media are saved in that browser. Export the show
            file before the event as a backup.
          </li>
          <li>Avoid pure green in lower-third colors, since it keys out.</li>
          <li>Keep the computer awake and plugged in during the show.</li>
          <li>
            Phone / Stream Deck remote uses a Hub PIN session (migration 156).
            Keep the control page open while the remote is in use.
          </li>
        </ul>
      </section>
    </div>
  );
}
