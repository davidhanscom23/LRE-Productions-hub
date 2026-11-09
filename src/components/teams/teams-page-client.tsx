"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteDepartmentLinkAction,
  deleteDepartmentVideoAction,
} from "@/app/(app)/teams/actions";
import { AvTimeRollup } from "@/components/teams/av-time-rollup";
import { AvTimeTracker } from "@/components/teams/av-time-tracker";
import { LinkFormModal, VideoFormModal } from "@/components/teams/team-modals";
import type { AvClockInEventOption } from "@/lib/teams/av-clock-in-events";
import {
  DEFAULT_PLANNING_LINKS,
  DEPARTMENT_META,
  PLANNING_BUTTON_STYLES,
  TRAINING_PORTAL_HREF,
} from "@/lib/teams/department-meta";
import type {
  AvTeamHoursRow,
  AvTeamShiftRow,
} from "@/lib/teams/av-time-rollup";
import {
  embedVideoUrl,
  resolveVideoThumbnail,
  type DepartmentLink,
  type DepartmentVideo,
  type TeamDepartment,
} from "@/lib/types/teams";
import type { TimeEntry } from "@/lib/types/time-tracker";

type TeamsPageClientProps = {
  links: DepartmentLink[];
  videos: DepartmentVideo[];
  canManage: boolean;
  visibleDepartments: TeamDepartment[];
  openTimeEntry: TimeEntry | null;
  recentTimeEntries: TimeEntry[];
  clockInEvents?: AvClockInEventOption[];
  hasCalendarFeed?: boolean;
  isAdmin?: boolean;
  calendarError?: string | null;
  teamHours?: AvTeamHoursRow[];
  teamShifts?: AvTeamShiftRow[];
};

export function TeamsPageClient({
  links,
  videos,
  canManage,
  visibleDepartments,
  openTimeEntry,
  recentTimeEntries,
  clockInEvents = [],
  hasCalendarFeed = false,
  isAdmin = false,
  calendarError = null,
  teamHours = [],
  teamShifts = [],
}: TeamsPageClientProps) {
  const [department, setDepartment] = useState<TeamDepartment>(
    visibleDepartments[0] ?? "Audiovisual",
  );
  const [category, setCategory] = useState("all");
  const [linkModal, setLinkModal] = useState<{
    open: boolean;
    link: DepartmentLink | null;
  }>({ open: false, link: null });
  const [videoModal, setVideoModal] = useState<{
    open: boolean;
    video: DepartmentVideo | null;
  }>({ open: false, video: null });
  const [playing, setPlaying] = useState<DepartmentVideo | null>(null);
  const videosRef = useRef<HTMLElement>(null);

  const activeDepartment =
    visibleDepartments.includes(department)
      ? department
      : (visibleDepartments[0] ?? null);

  const deptLinks = useMemo(
    () =>
      activeDepartment
        ? links.filter((l) => l.department === activeDepartment)
        : [],
    [links, activeDepartment],
  );

  const deptVideos = useMemo(
    () =>
      activeDepartment
        ? videos.filter((v) => v.department === activeDepartment)
        : [],
    [videos, activeDepartment],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const v of deptVideos) {
      if (v.category.trim()) set.add(v.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [deptVideos]);

  const filteredVideos = useMemo(() => {
    return deptVideos.filter((v) => {
      if (category !== "all" && v.category !== category) return false;
      return true;
    });
  }, [deptVideos, category]);

  const planningPlatforms = useMemo(() => {
    if (!activeDepartment) return [];
    if (deptLinks.length > 0) {
      return deptLinks.map((l) => ({
        id: l.id,
        title: l.title,
        url: l.url,
        description: l.description,
        managed: true as const,
        link: l,
      }));
    }
    return DEFAULT_PLANNING_LINKS[activeDepartment].map((l, i) => ({
      id: `fallback-${i}`,
      title: l.title,
      url: l.url,
      description: l.description,
      managed: false as const,
      link: null,
    }));
  }, [activeDepartment, deptLinks]);

  const meta = activeDepartment ? DEPARTMENT_META[activeDepartment] : null;
  const DeptIcon = meta?.icon;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Teams
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {canManage
            ? "Department resources, training, and tools for Audiovisual, Corporate, Wedding & Social, and Golf."
            : "Resources, training, and tools for your assigned departments."}
        </p>
      </div>

      {visibleDepartments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-12 text-center">
          <p className="font-medium text-[var(--foreground)]">
            No departments assigned
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ask an admin to add a department (Audiovisual, Corporate, Wedding
            &amp; Social, or Golf) to your profile in People so you can see
            Teams content.
          </p>
        </div>
      ) : (
        <>
          {/* Department tabs */}
          <div className="flex flex-wrap gap-2">
            {visibleDepartments.map((dept) => {
              const tabMeta = DEPARTMENT_META[dept];
              const TabIcon = tabMeta.icon;
              const active = activeDepartment === dept;
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => {
                    setDepartment(dept);
                    setCategory("all");
                  }}
                  className={[
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--brand)]/40 hover:text-[var(--foreground)]",
                  ].join(" ")}
                >
                  <TabIcon className="h-4 w-4" />
                  {dept}
                </button>
              );
            })}
          </div>

          {meta && DeptIcon && activeDepartment && (
            <>
              {/* Welcome banner */}
              <section className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--brand-soft)] via-[var(--surface)] to-[var(--surface)] px-5 py-6 sm:px-7 sm:py-7">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm">
                    <DeptIcon className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                      {meta.label}
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {meta.blurb}
                    </p>
                  </div>
                </div>
              </section>

              {/* Modules row — Audiovisual uses Time Tracker; others use planning platforms */}
              <div className="grid gap-4 lg:grid-cols-2">
                {activeDepartment === "Audiovisual" ? (
                  <AvTimeTracker
                    openEntry={openTimeEntry}
                    recentEntries={recentTimeEntries}
                    clockInEvents={clockInEvents}
                    hasCalendarFeed={hasCalendarFeed}
                    isAdmin={isAdmin}
                    calendarError={calendarError}
                  />
                ) : (
                  <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[var(--brand)] uppercase">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Event Planning Platforms
                      </h3>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() =>
                            setLinkModal({ open: true, link: null })
                          }
                          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </button>
                      )}
                    </div>

                    <ul className="space-y-2.5">
                      {planningPlatforms.map((platform, index) => (
                        <li key={platform.id} className="group relative">
                          <a
                            href={platform.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={[
                              "flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold text-white shadow-sm transition-opacity",
                              PLANNING_BUTTON_STYLES[
                                index % PLANNING_BUTTON_STYLES.length
                              ],
                            ].join(" ")}
                          >
                            <span className="min-w-0 truncate">
                              {platform.title}
                            </span>
                            <ExternalLink className="h-4 w-4 shrink-0 opacity-90" />
                          </a>
                          {canManage && platform.managed && platform.link && (
                            <div className="absolute top-1/2 right-12 z-10 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <IconButton
                                label="Edit link"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLinkModal({
                                    open: true,
                                    link: platform.link!,
                                  });
                                }}
                                className="bg-black/25 text-white hover:bg-black/40"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </IconButton>
                              <DeleteLinkButton link={platform.link} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>

                    {canManage && deptLinks.length === 0 && (
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        No planning platforms yet. Add links above to curate
                        tools for this department.
                      </p>
                    )}
                  </section>
                )}

                {/* Right module cards */}
                <div className="grid gap-3 sm:grid-cols-2 content-start">
                  <>
                      {deptLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand)]/35 hover:shadow-md"
                        >
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                            <ExternalLink className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[var(--foreground)]">
                              {link.title}
                            </p>
                            <p className="text-sm text-[var(--muted)]">
                              {link.description || "External tool"}
                            </p>
                          </div>
                          {canManage && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <IconButton
                                label="Edit link"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLinkModal({ open: true, link });
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </IconButton>
                              <DeleteLinkButton link={link} />
                            </div>
                          )}
                        </a>
                      ))}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() =>
                            setLinkModal({ open: true, link: null })
                          }
                          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-sm font-medium text-[var(--muted)] transition-colors hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
                        >
                          <Plus className="h-4 w-4" />
                          Add tool link
                        </button>
                      )}
                      <ModuleCard
                        href={TRAINING_PORTAL_HREF}
                        icon={GraduationCap}
                        title="Training Portal"
                        subtitle="Courses & progress"
                      />
                    </>
                  <button
                    type="button"
                    onClick={() =>
                      videosRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                    className="col-span-full flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand)]/35 hover:shadow-md sm:col-span-2"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Play className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--foreground)]">
                        Video Library
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {deptVideos.length === 0
                          ? "No tutorials yet"
                          : `${deptVideos.length} tutorial${deptVideos.length === 1 ? "" : "s"}${
                              categories.length > 0
                                ? ` across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`
                                : ""
                            }`}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-sm font-medium text-[var(--brand)]">
                      Browse
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                </div>
              </div>

              {activeDepartment === "Audiovisual" && canManage ? (
                <AvTimeRollup hours={teamHours} recentShifts={teamShifts} />
              ) : null}

              {/* Videos */}
              <section ref={videosRef} className="space-y-4 scroll-mt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)]">
                    <Play className="h-5 w-5 text-[var(--brand)]" />
                    Videos
                  </h2>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() =>
                        setVideoModal({ open: true, video: null })
                      }
                      className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white hover:opacity-90 sm:self-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Add video
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <CategoryChip
                    label="All"
                    active={category === "all"}
                    onClick={() => setCategory("all")}
                  />
                  {categories.map((c) => (
                    <CategoryChip
                      key={c}
                      label={c}
                      active={category === c}
                      onClick={() => setCategory(c)}
                    />
                  ))}
                </div>

                {filteredVideos.length === 0 ? (
                  <Empty
                    title="No videos yet"
                    body={
                      canManage
                        ? "Add the first tutorial video for this department."
                        : "Tutorial videos for this department will show up here."
                    }
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredVideos.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        canManage={canManage}
                        onPlay={() => setPlaying(video)}
                        onEdit={() =>
                          setVideoModal({ open: true, video })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {activeDepartment && (
        <>
          <LinkFormModal
            key={linkModal.open ? (linkModal.link?.id ?? "new") : "closed"}
            open={linkModal.open}
            department={activeDepartment}
            link={linkModal.link}
            onClose={() => setLinkModal({ open: false, link: null })}
          />
          <VideoFormModal
            key={videoModal.open ? (videoModal.video?.id ?? "new") : "closed"}
            open={videoModal.open}
            department={activeDepartment}
            video={videoModal.video}
            categories={categories}
            onClose={() => setVideoModal({ open: false, video: null })}
          />
        </>
      )}
      {playing && (
        <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}

function ModuleCard({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand)]/35 hover:shadow-md"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-[var(--foreground)]">{title}</p>
        <p className="text-sm text-[var(--muted)]">{subtitle}</p>
      </div>
    </Link>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--foreground)] text-[var(--surface)]"
          : "bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function DeleteLinkButton({ link }: { link: DepartmentLink }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <IconButton
      label="Delete link"
      disabled={pending}
      className="bg-black/25 text-white hover:bg-black/40"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`Delete “${link.title}”?`)) return;
        startTransition(async () => {
          const result = await deleteDepartmentLinkAction(link.id);
          if (!result.error) router.refresh();
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </IconButton>
  );
}

function VideoCard({
  video,
  canManage,
  onPlay,
  onEdit,
}: {
  video: DepartmentVideo;
  canManage: boolean;
  onPlay: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const thumb = resolveVideoThumbnail(video);

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <button
        type="button"
        onClick={onPlay}
        className="group relative block aspect-video w-full bg-[var(--background)]"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted)]">
            <Play className="h-10 w-10" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </span>
      </button>
      <div className="space-y-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
              <Play className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
              <span className="truncate">{video.title}</span>
            </p>
            {video.description && (
              <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                {video.description}
              </p>
            )}
            {video.category && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {video.category}
              </p>
            )}
          </div>
          {canManage && (
            <div className="flex shrink-0 gap-1">
              <IconButton label="Edit video" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                label="Delete video"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Delete “${video.title}”?`)) return;
                  startTransition(async () => {
                    const result = await deleteDepartmentVideoAction(video.id);
                    if (!result.error) router.refresh();
                  });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function VideoPlayerModal({
  video,
  onClose,
}: {
  video: DepartmentVideo;
  onClose: () => void;
}) {
  const embed = embedVideoUrl(video.video_url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--foreground)]/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <p className="truncate font-medium text-[var(--foreground)]">
            {video.title}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {embed ? (
          <div className="aspect-video bg-black">
            <iframe
              src={embed}
              title={video.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="space-y-3 p-6 text-center">
            <p className="text-sm text-[var(--muted)]">
              This video opens in a new tab.
            </p>
            <a
              href={video.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" />
              Open video
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 px-6 py-10 text-center">
      <p className="font-medium text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}
