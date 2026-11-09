"use client";

import {
  Fragment,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createHoneyBookClientAction,
  createHoneyBookProjectAction,
  deleteHoneyBookClientAction,
  deleteHoneyBookProjectAction,
  enableProjectShareAction,
  importHoneyBookCsvAction,
  revokeProjectShareAction,
  updateHoneyBookClientAction,
  updateHoneyBookProjectAction,
  updateProjectStageAction,
} from "@/app/(app)/honeybook/actions";
import {
  AssigneeChips,
  ManagerAssigneePicker,
  PendingAssignmentPanel,
  StaffAssignRequest,
  projectCardStyle,
  type StaffOption,
} from "@/components/honeybook/honeybook-assignees";
import { MergeProjectsDialog } from "@/components/honeybook/merge-projects-dialog";
import { ProjectFilesStaff } from "@/components/honeybook/project-files-staff";
import { ProjectQuestionnaireStaff } from "@/components/honeybook/project-questionnaire-staff";
import { HoneyBookSourceBadge } from "@/components/honeybook/source-badge";
import {
  buildDuplicateMap,
  findSimilarProjects,
  type DupMatch,
} from "@/lib/honeybook/duplicates";
import {
  applyPipelineColumnOrder,
  HONEYBOOK_DEFAULT_BOARD_STAGES,
  countProjectsByStageLabel,
  formatHoneyBookStageLabel,
  groupProjectsByStage,
  HONEYBOOK_BOARD_ORDER_KEY,
  honeyBookStageMatchKey,
  movePipelineColumn,
  orderedPipelineStages,
} from "@/lib/honeybook/pipeline-board";
import {
  UNASSIGNED_FILTER,
  PROJECT_SCOPE_STORAGE_KEY,
  defaultScope,
  isUnassigned,
  isValidScope,
  matchesScope,
  type ProjectScope,
} from "@/lib/honeybook/project-scope";
import { PartnershipsPanel } from "@/components/honeybook/partnerships-panel";
import { PaymentRow } from "@/components/honeybook/payment-row";
import { PaymentMatchReview } from "@/components/honeybook/payment-match-review";
import { needsMatchReview } from "@/lib/honeybook/payment-matching";
import { isPartnership } from "@/lib/honeybook/partnerships";
import {
  formatHoneyBookMoney,
  HONEYBOOK_STAGE_HINTS,
  projectBudgetNumber,
  type HoneyBookAssignmentRequest,
  type HoneyBookClient,
  type HoneyBookPayment,
  type PartnershipFinancials,
  type HoneyBookProject,
  type HoneyBookStageEvent,
  type HoneyBookWebhookEvent,
} from "@/lib/types/honeybook";

type Tab =
  | "overview"
  | "projects"
  | "partnerships"
  | "clients"
  | "payments"
  | "setup";

type BoardOrderCache = { raw: string | null; keys: string[] | null };

const scopeListeners = new Set<() => void>();

function subscribeScope(onStoreChange: () => void) {
  scopeListeners.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROJECT_SCOPE_STORAGE_KEY || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    scopeListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getScopeSnapshot(): ProjectScope | null {
  try {
    const raw = window.localStorage.getItem(PROJECT_SCOPE_STORAGE_KEY);
    return isValidScope(raw) ? raw : null;
  } catch {
    return null;
  }
}

function getScopeServerSnapshot(): ProjectScope | null {
  return null;
}

function writeScope(scope: ProjectScope) {
  try {
    window.localStorage.setItem(PROJECT_SCOPE_STORAGE_KEY, scope);
  } catch {
    /* storage blocked: the choice just won't be remembered */
  }
  scopeListeners.forEach((fn) => fn());
}

let boardOrderCache: BoardOrderCache = { raw: "\0", keys: null };
const boardOrderListeners = new Set<() => void>();

function parseBoardOrderKeys(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((x): x is string => typeof x === "string")
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readBoardOrderCache(): BoardOrderCache {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HONEYBOOK_BOARD_ORDER_KEY);
  } catch {
    raw = null;
  }
  if (boardOrderCache.raw === raw) return boardOrderCache;
  boardOrderCache = { raw, keys: parseBoardOrderKeys(raw) };
  return boardOrderCache;
}

function subscribeBoardOrder(onStoreChange: () => void) {
  boardOrderListeners.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === HONEYBOOK_BOARD_ORDER_KEY || e.key === null) {
      boardOrderCache = { raw: "\0", keys: null };
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    boardOrderListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getBoardOrderSnapshot(): string[] | null {
  return readBoardOrderCache().keys;
}

function getBoardOrderServerSnapshot(): string[] | null {
  return null;
}

function writeBoardOrderKeys(keys: string[] | null) {
  try {
    if (keys?.length) {
      window.localStorage.setItem(
        HONEYBOOK_BOARD_ORDER_KEY,
        JSON.stringify(keys),
      );
    } else {
      window.localStorage.removeItem(HONEYBOOK_BOARD_ORDER_KEY);
    }
  } catch {
    /* private mode / quota */
  }
  boardOrderCache = { raw: "\0", keys: null };
  boardOrderListeners.forEach((l) => l());
}

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "projects", label: "Projects" },
  { id: "partnerships", label: "Partnerships" },
  { id: "clients", label: "Clients" },
  { id: "payments", label: "Payments" },
  { id: "setup", label: "Zapier setup" },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children}
    </section>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p> : null}
    </div>
  );
}

type CreateProjectPayload = Parameters<typeof createHoneyBookProjectAction>[0];

/** "Possible duplicate" chip on a card; managers can click it to review and merge. */
function DuplicateBadge({
  matches,
  byId,
  canMerge,
  onReview,
}: {
  matches: DupMatch[] | undefined;
  byId: Map<string, HoneyBookProject>;
  canMerge: boolean;
  onReview: (otherId: string) => void;
}) {
  if (!matches || matches.length === 0) return null;
  const top = byId.get(matches[0].id);
  const label = `Possible duplicate${top ? ` of “${top.name}”` : ""}`;
  const cls =
    "mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300";
  if (!canMerge) {
    return <span className={cls}>{label}</span>;
  }
  return (
    <button
      type="button"
      className={`${cls} hover:bg-amber-500/20`}
      title={matches[0].reasons.join(", ")}
      onClick={() => onReview(matches[0].id)}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden>·</span>
      <span className="shrink-0 underline">Review &amp; merge</span>
    </button>
  );
}

export function HoneyBookClient({
  clients,
  projects: allProjects,
  payments,
  recentEvents,
  webhookConfigured,
  partnershipFinancials = {},
  packetLinks = {},
  stageEventsByProject = {},
  isAdmin = true,
  canManage = true,
  canAssign = true,
  currentProfileId = "",
  staffOptions = [],
  assignmentRequests = [],
  initialTab = "overview",
}: {
  clients: HoneyBookClient[];
  projects: HoneyBookProject[];
  payments: HoneyBookPayment[];
  recentEvents: HoneyBookWebhookEvent[];
  webhookConfigured: boolean;
  /** Admin-only money for partnerships (empty for everyone else). */
  partnershipFinancials?: Record<string, PartnershipFinancials>;
  packetLinks?: Record<
    string,
    { id: string; client_name: string; event_date: string }[]
  >;
  stageEventsByProject?: Record<string, HoneyBookStageEvent[]>;
  /** Admins see Zapier setup, CSV import, and webhook activity. */
  isAdmin?: boolean;
  /** Admin or Lead — create/delete Hub CRM rows. */
  canManage?: boolean;
  /** Admin — assign staff to projects. */
  canAssign?: boolean;
  currentProfileId?: string;
  staffOptions?: StaffOption[];
  assignmentRequests?: HoneyBookAssignmentRequest[];
  initialTab?: Tab;
}) {
  const router = useRouter();
  // Partnerships live on their own tab and never count toward event stats or the event board.
  const projects = useMemo(
    () => allProjects.filter((p) => !isPartnership(p)),
    [allProjects],
  );
  const partnershipProjects = useMemo(
    () => allProjects.filter((p) => isPartnership(p)),
    [allProjects],
  );
  const [tab, setTab] = useState<Tab>(
    ["overview", "projects", "partnerships", "clients", "payments", "setup"].includes(
      initialTab,
    )
      ? initialTab
      : "overview",
  );
  const reviewCount = useMemo(
    () => (isAdmin ? payments.filter((p) => needsMatchReview(p)).length : 0),
    [payments, isAdmin],
  );
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const [csvText, setCsvText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<{
    source: HoneyBookProject;
    otherId: string | null;
  } | null>(null);
  const [dupWarning, setDupWarning] = useState<{
    payload: CreateProjectPayload;
    matches: HoneyBookProject[];
  } | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectView, setProjectView] = useState<"list" | "board">("board");
  const savedScope = useSyncExternalStore(
    subscribeScope,
    getScopeSnapshot,
    getScopeServerSnapshot,
  );
  const scope: ProjectScope = savedScope ?? defaultScope(isAdmin);
  const [personFilter, setPersonFilter] = useState("");
  /** Preferred column match-keys from localStorage (null = default hint order). */
  const columnOrderKeys = useSyncExternalStore(
    subscribeBoardOrder,
    getBoardOrderSnapshot,
    getBoardOrderServerSnapshot,
  );
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const visibleTabs = useMemo(
    () => (isAdmin ? TABS : TABS.filter((t) => t.id !== "setup")),
    [isAdmin],
  );

  /** Stage option values for selects: hints + distinct raw project stages. */
  const stages = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const h of HONEYBOOK_STAGE_HINTS) {
      byKey.set(honeyBookStageMatchKey(h), h);
    }
    for (const p of projects) {
      const raw = p.stage?.trim();
      if (!raw) continue;
      const key = honeyBookStageMatchKey(raw);
      if (!byKey.has(key)) byKey.set(key, raw);
    }
    return Array.from(byKey.values()).sort((a, b) =>
      formatHoneyBookStageLabel(a).localeCompare(formatHoneyBookStageLabel(b)),
    );
  }, [projects]);

  const duplicateMap = useMemo(() => buildDuplicateMap(projects), [projects]);
  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  function submitNewProject(payload: CreateProjectPayload) {
    setFormError(null);
    startTransition(async () => {
      const r = await createHoneyBookProjectAction(payload);
      if (r.error) {
        setFormError(r.error);
        return;
      }
      setDupWarning(null);
      setShowNewProject(false);
      router.refresh();
    });
  }

  /** Admin always; otherwise only people on the card. */
  function canEditProject(p: HoneyBookProject) {
    if (isAdmin) return true;
    return (p.assignees ?? []).some((a) => a.profile_id === currentProfileId);
  }

  const stageCounts = useMemo(
    () => countProjectsByStageLabel(projects),
    [projects],
  );

  const paidTotal = useMemo(
    () =>
      payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments],
  );

  const bookedCount = useMemo(
    () =>
      projects.filter((p) => /booked/i.test(p.stage) || p.booked_at).length,
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (!matchesScope(p, { scope, profileId: currentProfileId, personFilter })) {
        return false;
      }
      if (
        stageFilter &&
        honeyBookStageMatchKey(p.stage) !== honeyBookStageMatchKey(stageFilter)
      ) {
        return false;
      }
      if (!q) return true;
      const stageLabel = formatHoneyBookStageLabel(p.stage).toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.client_name ?? "").toLowerCase().includes(q) ||
        (p.client_email ?? "").toLowerCase().includes(q) ||
        p.stage.toLowerCase().includes(q) ||
        stageLabel.includes(q) ||
        p.location.toLowerCase().includes(q)
      );
    });
  }, [projects, query, stageFilter, scope, currentProfileId, personFilter]);

  const unassignedCount = useMemo(
    () => projects.filter((p) => isUnassigned(p)).length,
    [projects],
  );
  const mineCount = useMemo(
    () =>
      projects.filter((p) =>
        matchesScope(p, { scope: "mine", profileId: currentProfileId, personFilter: "" }),
      ).length,
    [projects, currentProfileId],
  );

  function chooseScope(next: ProjectScope) {
    if (next === "mine") setPersonFilter("");
    writeScope(next);
  }

  function showUnassigned() {
    setPersonFilter(UNASSIGNED_FILTER);
    writeScope("everyone");
  }

  const boardColumns = useMemo(
    () =>
      applyPipelineColumnOrder(
        orderedPipelineStages(projects.map((p) => p.stage)),
        columnOrderKeys,
      ),
    [projects, columnOrderKeys],
  );

  const boardGroups = useMemo(
    () => groupProjectsByStage(filteredProjects, boardColumns),
    [filteredProjects, boardColumns],
  );

  const visibleBoardColumns = useMemo(() => {
    const defaultKeys = new Set(
      HONEYBOOK_DEFAULT_BOARD_STAGES.map((s) => honeyBookStageMatchKey(s)),
    );
    return boardColumns.filter(
      (col) =>
        (boardGroups.get(col)?.length ?? 0) > 0 ||
        defaultKeys.has(honeyBookStageMatchKey(col)),
    );
  }, [boardColumns, boardGroups]);

  function persistColumnOrder(cols: string[]) {
    writeBoardOrderKeys(cols.map((c) => honeyBookStageMatchKey(c)));
  }

  function resetColumnOrder() {
    setDragCol(null);
    setDropTarget(null);
    writeBoardOrderKeys(null);
  }

  function changeStage(id: string, stage: string) {
    startTransition(async () => {
      const r = await updateProjectStageAction({ id, stage });
      if (r.error) alert(r.error);
      else router.refresh();
    });
  }

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }, [clients, query]);

  function runImport() {
    setImportMsg(null);
    startTransition(async () => {
      const r = await importHoneyBookCsvAction(csvText);
      if (r.error && !r.imported) {
        setImportMsg(r.error);
        return;
      }
      setImportMsg(
        r.error ??
          `Imported ${r.imported ?? 0} row${(r.imported ?? 0) === 1 ? "" : "s"}.`,
      );
      setCsvText("");
      router.refresh();
    });
  }

  return (
    <>
    {mergeTarget ? (
      <MergeProjectsDialog
        source={mergeTarget.source}
        candidates={projects}
        initialOtherId={mergeTarget.otherId}
        onClose={() => setMergeTarget(null)}
        onMerged={() => {
          setMergeTarget(null);
          router.refresh();
        }}
      />
    ) : null}
    <div
      className={`mx-auto space-y-6 pb-16 ${
        tab === "projects" && projectView === "board"
          ? "max-w-[min(100%,88rem)]"
          : "max-w-5xl"
      }`}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            HoneyBook
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Clients, projects, and payments — synced from HoneyBook via Zapier
            into the Hub (one-way). Hub edits (stage, assignees, details) stay
            in the Hub; HoneyBook has no public API for write-back.
          </p>
        </div>
        {canManage ? (
          <a
            href="/honeybook/reports"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium"
          >
            Sales reports
          </a>
        ) : null}
        {canManage ? (
          <a
            href="/honeybook/archive"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium"
          >
            Archive and backup
          </a>
        ) : null}
        {isAdmin ? (
          <a
            href="/quickbooks"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium"
          >
            QuickBooks sync
          </a>
        ) : null}
        {isAdmin ? (
          <a
            href="/honeybook/automations"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium"
          >
            Email automations
          </a>
        ) : null}
        {isAdmin ? (
          <div
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              webhookConfigured
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                : "bg-amber-500/15 text-amber-900 dark:text-amber-200"
            }`}
          >
            {webhookConfigured
              ? "Webhook secret set"
              : "Webhook secret missing"}
          </div>
        ) : (
          <div className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
            Lead view
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-px">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
            {t.id === "payments" && reviewCount > 0 ? (
              <span
                className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                title="Payments waiting for you to match them to a project"
              >
                {reviewCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <PendingAssignmentPanel
            requests={assignmentRequests}
            isAdmin={isAdmin}
          />
          {reviewCount > 0 ? (
            <button
              type="button"
              onClick={() => setTab("payments")}
              className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <span className="font-semibold">
                {reviewCount} payment{reviewCount === 1 ? "" : "s"} need a project match.
              </span>{" "}
              Open Payments to approve the Hub&apos;s suggestions.
            </button>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Projects" value={String(projects.length)} />
            <Stat label="Clients" value={String(clients.length)} />
            <Stat
              label="Booked / active"
              value={String(bookedCount)}
              sub="stage contains Booked or has booked date"
            />
            <Stat
              label="Payments tracked"
              value={formatHoneyBookMoney(paidTotal)}
              sub={
                paidTotal === 0 && payments.length > 0
                  ? "Amounts not sent by Zapier yet"
                  : `${payments.length} payments`
              }
            />
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Projects by stage
            </h2>
            {stageCounts.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No projects yet. Connect Zapier (Setup tab) or import a CSV.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {stageCounts.map(([stage, count]) => (
                  <li
                    key={stage}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-[var(--foreground)]">{stage}</span>
                    <span className="font-medium text-[var(--muted)]">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {isAdmin ? (
          <Card>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Recent webhook activity
            </h2>
            {recentEvents.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No deliveries yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {recentEvents.slice(0, 12).map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
                  >
                    <span className="text-[var(--foreground)]">
                      {e.event_type || "event"}{" "}
                      <span
                        className={
                          e.status === "ok"
                            ? "text-emerald-700 dark:text-emerald-300"
                            : e.status === "error"
                              ? "text-red-700 dark:text-red-300"
                              : "text-[var(--muted)]"
                        }
                      >
                        · {e.status}
                      </span>
                      {e.error_message ? (
                        <span className="text-[var(--muted)]">
                          {" "}
                          — {e.error_message}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "projects" ? (
        <div className="space-y-4">
          <PendingAssignmentPanel
            requests={assignmentRequests}
            isAdmin={isAdmin}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex rounded-lg border border-[var(--border)] p-0.5 text-xs font-medium">
              <button
                type="button"
                className={`rounded-md px-2.5 py-1.5 ${
                  projectView === "board"
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => {
                  setStageFilter("");
                  setProjectView("board");
                }}
              >
                Board
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 py-1.5 ${
                  projectView === "list"
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => setProjectView("list")}
              >
                List
              </button>
            </div>
            <div
              className="flex rounded-lg border border-[var(--border)] p-0.5 text-xs font-medium"
              role="group"
              aria-label="Which projects to show"
            >
              <button
                type="button"
                aria-pressed={scope === "mine"}
                className={`rounded-md px-2.5 py-1.5 ${
                  scope === "mine"
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => chooseScope("mine")}
              >
                My projects
              </button>
              <button
                type="button"
                aria-pressed={scope === "everyone"}
                className={`rounded-md px-2.5 py-1.5 ${
                  scope === "everyone"
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => chooseScope("everyone")}
              >
                Everyone
              </button>
            </div>
            {isAdmin && scope === "everyone" ? (
              <select
                className={`${inputCls} sm:max-w-[200px]`}
                aria-label="Filter by person"
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
              >
                <option value="">All people</option>
                <option value={UNASSIGNED_FILTER}>Unassigned</option>
                {staffOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              className={inputCls}
              placeholder="Search projects, clients, locations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {projectView === "list" ? (
              <select
                className={`${inputCls} sm:max-w-[220px]`}
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="">All stages</option>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {formatHoneyBookStageLabel(s)}
                  </option>
                ))}
              </select>
            ) : (
              <>
                {columnOrderKeys ? (
                  <button
                    type="button"
                    className="h-9 shrink-0 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)]"
                    onClick={resetColumnOrder}
                  >
                    Reset column order
                  </button>
                ) : (
                  <span className="hidden text-xs text-[var(--muted)] sm:inline">
                    Drag column headers to reorder
                  </span>
                )}
              </>
            )}
            {canManage ? (
            <button
              type="button"
              className="h-9 shrink-0 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white hover:opacity-90"
              onClick={() => {
                setFormError(null);
                setShowNewProject((v) => !v);
              }}
            >
              {showNewProject ? "Cancel" : "New project"}
            </button>
            ) : null}
          </div>
          {showNewProject ? (
            <Card>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                New Hub project
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Creates a Hub CRM row (source: hub). Does not create anything in
                HoneyBook.
              </p>
              <form
                className="mt-3 grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  setFormError(null);
                  const payload: CreateProjectPayload = {
                    name: String(fd.get("name") ?? ""),
                    stage: String(fd.get("stage") ?? ""),
                    clientId: String(fd.get("client_id") ?? "") || null,
                    projectType: String(fd.get("project_type") ?? ""),
                    projectDate: String(fd.get("project_date") ?? "") || null,
                    location: String(fd.get("location") ?? ""),
                    details: String(fd.get("details") ?? ""),
                    budget: String(fd.get("budget") ?? "") || null,
                  };
                  const cl = payload.clientId
                    ? clients.find((c) => c.id === payload.clientId)
                    : undefined;
                  const hits = findSimilarProjects(
                    {
                      id: "new-project",
                      name: payload.name,
                      client_id: payload.clientId,
                      client_email: cl?.email ?? null,
                      project_date: payload.projectDate,
                    },
                    projects,
                  )
                    .map((m) => projectsById.get(m.id))
                    .filter((p): p is HoneyBookProject => Boolean(p));
                  if (hits.length > 0) {
                    setDupWarning({ payload, matches: hits });
                    return;
                  }
                  submitNewProject(payload);
                }}
              >
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">Name</span>
                  <input name="name" required className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Stage</span>
                  <select
                    name="stage"
                    className={inputCls}
                    defaultValue="Inquiry"
                  >
                    {HONEYBOOK_STAGE_HINTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Client</span>
                  <select name="client_id" className={inputCls} defaultValue="">
                    <option value="">—</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name || c.email || c.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Type</span>
                  <input
                    name="project_type"
                    placeholder="Wedding, Corporate…"
                    className={inputCls}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Date</span>
                  <input name="project_date" type="date" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Location</span>
                  <input name="location" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Budget</span>
                  <input
                    name="budget"
                    inputMode="decimal"
                    placeholder="0"
                    className={inputCls}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[var(--muted)]">Details</span>
                  <textarea
                    name="details"
                    rows={2}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </label>
                {formError ? (
                  <p className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
                    {formError}
                  </p>
                ) : null}
                {dupWarning ? (
                  <div
                    className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-sm sm:col-span-2"
                    role="alert"
                  >
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      This looks like a card you already have
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-[var(--foreground)]">
                      {dupWarning.matches.slice(0, 3).map((m) => (
                        <li key={m.id}>
                          <Link
                            href={`/honeybook/projects/${m.id}`}
                            className="font-semibold text-[var(--brand)] hover:underline"
                          >
                            {m.name}
                          </Link>{" "}
                          <span className="text-[var(--muted)]">
                            {[m.client_name, m.project_date, formatHoneyBookStageLabel(m.stage)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        className="h-8 rounded-lg bg-[var(--brand)] px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                        onClick={() => submitNewProject(dupWarning.payload)}
                      >
                        Create anyway
                      </button>
                      <button
                        type="button"
                        className="h-8 rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--foreground)] hover:bg-[var(--background)]"
                        onClick={() => setDupWarning(null)}
                      >
                        Back to edit
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Create project"}
                  </button>
                </div>
              </form>
            </Card>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
            <span>
              Showing {filteredProjects.length} of {projects.length} projects
              {scope === "mine" ? " (yours)" : ""}
            </span>
            {unassignedCount > 0 && personFilter !== UNASSIGNED_FILTER ? (
              <button
                type="button"
                className="font-medium text-[var(--brand)] hover:underline"
                onClick={showUnassigned}
              >
                {unassignedCount} unassigned
              </button>
            ) : null}
            {personFilter === UNASSIGNED_FILTER ? (
              <button
                type="button"
                className="font-medium text-[var(--brand)] hover:underline"
                onClick={() => setPersonFilter("")}
              >
                Clear unassigned filter
              </button>
            ) : null}
          </div>

          {filteredProjects.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {scope === "mine" && mineCount === 0
                ? "No projects are assigned to you yet. "
                : "No matching projects. "}
              {scope === "mine" ? (
                <button
                  type="button"
                  className="font-medium text-[var(--brand)] hover:underline"
                  onClick={() => chooseScope("everyone")}
                >
                  Search everyone
                </button>
              ) : null}
            </p>
          ) : projectView === "board" ? (
            <div className="-mx-1 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-3 px-1">
                {visibleBoardColumns.map((col) => {
                    const colProjects = boardGroups.get(col) ?? [];
                    const empty = colProjects.length === 0;
                    const isDragging = dragCol === col;
                    const isDropTarget =
                      dropTarget === col && dragCol !== null && dragCol !== col;
                    return (
                      <div
                        key={col}
                        className={`flex shrink-0 flex-col rounded-2xl border bg-[var(--background)] transition ${
                          empty ? "w-32" : "w-64"
                        } ${
                          isDropTarget
                            ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/30"
                            : "border-[var(--border)]"
                        } ${isDragging ? "opacity-50" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragCol && dragCol !== col) setDropTarget(col);
                        }}
                        onDragLeave={(e) => {
                          if (
                            e.currentTarget.contains(e.relatedTarget as Node)
                          ) {
                            return;
                          }
                          if (dropTarget === col) setDropTarget(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from =
                            e.dataTransfer.getData("text/plain") || dragCol;
                          if (from && from !== col) {
                            persistColumnOrder(
                              movePipelineColumn(boardColumns, from, col),
                            );
                          }
                          setDragCol(null);
                          setDropTarget(null);
                        }}
                      >
                        <div
                          className="flex cursor-grab items-baseline justify-between gap-2 border-b border-[var(--border)] px-3 py-2 active:cursor-grabbing"
                          draggable
                          title="Drag to reorder columns"
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", col);
                            e.dataTransfer.effectAllowed = "move";
                            setDragCol(col);
                          }}
                          onDragEnd={() => {
                            setDragCol(null);
                            setDropTarget(null);
                          }}
                        >
                          <h3
                            className={`flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[var(--foreground)] ${
                              empty ? "leading-snug" : ""
                            }`}
                          >
                            <span
                              className="shrink-0 text-[var(--muted)]"
                              aria-hidden
                            >
                              ⋮⋮
                            </span>
                            <span className="truncate">{col}</span>
                          </h3>
                          <span className="shrink-0 text-xs text-[var(--muted)]">
                            {colProjects.length}
                          </span>
                        </div>
                        <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
                          {empty ? (
                            <li className="px-1 py-3 text-xs text-[var(--muted)]">
                              Empty
                            </li>
                          ) : (
                            colProjects.map((p) => {
                              const editable = canEditProject(p);
                              const style = projectCardStyle(p.assignees);
                              const stageValue =
                                stages.find(
                                  (s) =>
                                    honeyBookStageMatchKey(s) ===
                                    honeyBookStageMatchKey(p.stage),
                                ) ?? p.stage;
                              return (
                              <li
                                key={p.id}
                                className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition hover:border-[var(--brand)]/40"
                                style={style}
                              >
                                <Link
                                  href={`/honeybook/projects/${p.id}`}
                                  className="absolute inset-0 z-0 rounded-xl"
                                  aria-label={`Open ${p.name}`}
                                />
                                <div className="relative z-10 pointer-events-none">
                                  <p className="text-sm font-semibold text-[var(--foreground)]">
                                    {p.name}
                                    <HoneyBookSourceBadge
                                      sourceEvent={p.source_event}
                                      className="ml-1 rounded px-1 py-0.5 text-[10px] font-semibold"
                                    />
                                    {!editable ? (
                                      <span className="ml-1 text-[10px] font-medium text-[var(--muted)]">
                                        View only
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                                    {p.client_name || "No client"}
                                    {p.project_date
                                      ? ` · ${p.project_date}`
                                      : ""}
                                  </p>
                                </div>
                                <div className="relative z-10">
                                {canAssign ? (
                                  <ManagerAssigneePicker
                                    project={p}
                                    staffOptions={staffOptions}
                                    compact
                                  />
                                ) : (
                                  <AssigneeChips
                                    assignees={p.assignees ?? []}
                                  />
                                )}
                                <DuplicateBadge
                                  matches={duplicateMap.get(p.id)}
                                  byId={projectsById}
                                  canMerge={canManage}
                                  onReview={(otherId) =>
                                    setMergeTarget({ source: p, otherId })
                                  }
                                />
                                {editable ? (
                                <select
                                  className={`${inputCls} mt-2 h-8 text-xs`}
                                  value={stageValue || ""}
                                  disabled={pending}
                                  aria-label={`Stage for ${p.name}`}
                                  onChange={(e) =>
                                    changeStage(p.id, e.target.value)
                                  }
                                >
                                  {!stages.some(
                                    (s) =>
                                      honeyBookStageMatchKey(s) ===
                                      honeyBookStageMatchKey(p.stage),
                                  ) && p.stage ? (
                                    <option value={p.stage}>
                                      {formatHoneyBookStageLabel(p.stage)}
                                    </option>
                                  ) : null}
                                  {stages.map((s) => (
                                    <option key={s} value={s}>
                                      {formatHoneyBookStageLabel(s)}
                                    </option>
                                  ))}
                                </select>
                                ) : (
                                  <p className="mt-2 text-xs text-[var(--muted)]">
                                    Stage:{" "}
                                    {formatHoneyBookStageLabel(p.stage) || "—"}
                                  </p>
                                )}
                                </div>
                              </li>
                              );
                            })
                          )}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((p) => {
                const editable = canEditProject(p);
                return (
                <Card key={p.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[var(--foreground)]">
                        <Link
                          href={`/honeybook/projects/${p.id}`}
                          className="hover:text-[var(--brand)] hover:underline"
                        >
                          {p.name}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-sm text-[var(--muted)]">
                        {p.client_name || "No client"}
                        {p.client_email ? ` · ${p.client_email}` : ""}
                        <HoneyBookSourceBadge
                          sourceEvent={p.source_event}
                          className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        />
                        {!editable ? (
                          <span className="ml-1 text-[10px] text-[var(--muted)]">
                            View only
                          </span>
                        ) : null}
                      </p>
                      <AssigneeChips assignees={p.assignees ?? []} />
                      <DuplicateBadge
                        matches={duplicateMap.get(p.id)}
                        byId={projectsById}
                        canMerge={canManage}
                        onReview={(otherId) =>
                          setMergeTarget({ source: p, otherId })
                        }
                      />
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {[
                          p.project_type || null,
                          p.project_date || null,
                          p.location || null,
                          projectBudgetNumber(p.budget) > 0
                            ? formatHoneyBookMoney(p.budget)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {(packetLinks[p.id] ?? []).length > 0 ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          Event packet
                          {(packetLinks[p.id] ?? []).length === 1 ? "" : "s"}:{" "}
                          {(packetLinks[p.id] ?? []).map((pkt, i) => (
                            <span key={pkt.id}>
                              {i > 0 ? ", " : null}
                              <Link
                                href={`/event-packets/${pkt.id}`}
                                className="font-medium text-[var(--brand)] hover:underline"
                              >
                                {pkt.client_name || "Packet"} ({pkt.event_date})
                              </Link>
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {editable ? (
                      <select
                        className={`${inputCls} w-auto min-w-[140px]`}
                        value={
                          stages.find(
                            (s) =>
                              honeyBookStageMatchKey(s) ===
                              honeyBookStageMatchKey(p.stage),
                          ) ?? p.stage
                        }
                        disabled={pending}
                        onChange={(e) => changeStage(p.id, e.target.value)}
                      >
                        {!stages.some(
                          (s) =>
                            honeyBookStageMatchKey(s) ===
                            honeyBookStageMatchKey(p.stage),
                        ) && p.stage ? (
                          <option value={p.stage}>
                            {formatHoneyBookStageLabel(p.stage)}
                          </option>
                        ) : null}
                        {stages.map((s) => (
                          <option key={s} value={s}>
                            {formatHoneyBookStageLabel(s)}
                          </option>
                        ))}
                      </select>
                      ) : (
                        <span className="text-sm text-[var(--muted)]">
                          {formatHoneyBookStageLabel(p.stage) || "—"}
                        </span>
                      )}
                      <Link
                        href={`/honeybook/projects/${p.id}`}
                        className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                      >
                        Open
                      </Link>
                      {editable ? (
                      <button
                        type="button"
                        className="h-9 rounded-lg px-3 text-sm text-[var(--foreground)] hover:bg-[var(--background)]"
                        disabled={pending}
                        onClick={() => {
                          setFormError(null);
                          setShowNewProject(false);
                          setEditingProjectId(
                            editingProjectId === p.id ? null : p.id,
                          );
                        }}
                      >
                        {editingProjectId === p.id ? "Cancel" : "Quick edit"}
                      </button>
                      ) : null}
                      {editable ? (
                      <button
                        type="button"
                        className="h-9 rounded-lg px-3 text-sm text-[var(--brand)] hover:bg-[var(--brand)]/10"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const r = await enableProjectShareAction({
                              id: p.id,
                            });
                            if (r.error) {
                              alert(r.error);
                              return;
                            }
                            const path =
                              r.path ??
                              (r.token ? `/project/${r.token}` : null);
                            if (path) {
                              const url = `${window.location.origin}${path}`;
                              try {
                                await navigator.clipboard.writeText(url);
                                alert(`Client link copied:\n${url}`);
                              } catch {
                                prompt("Copy client link", url);
                              }
                            }
                            router.refresh();
                          });
                        }}
                      >
                        {p.share_enabled ? "Copy client link" : "Share link"}
                      </button>
                      ) : null}
                      {editable && p.share_enabled ? (
                        <button
                          type="button"
                          className="h-9 rounded-lg px-3 text-sm text-[var(--muted)] hover:bg-[var(--background)]"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              const r = await revokeProjectShareAction({
                                id: p.id,
                              });
                              if (r.error) alert(r.error);
                              else router.refresh();
                            });
                          }}
                        >
                          Stop sharing
                        </button>
                      ) : null}
                      {canManage ? (
                      <button
                        type="button"
                        className="h-9 rounded-lg px-3 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Delete project “${p.name}”?`)) return;
                          startTransition(async () => {
                            const r = await deleteHoneyBookProjectAction({
                              id: p.id,
                            });
                            if (r.error) alert(r.error);
                            else router.refresh();
                          });
                        }}
                      >
                        Delete
                      </button>
                      ) : null}
                    </div>
                  </div>
                  {editingProjectId === p.id ? (
                    <form
                      className="mt-3 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        setFormError(null);
                        startTransition(async () => {
                          const r = await updateHoneyBookProjectAction({
                            id: p.id,
                            name: String(fd.get("name") ?? ""),
                            stage: String(fd.get("stage") ?? ""),
                            clientId: String(fd.get("client_id") ?? "") || null,
                            projectType: String(fd.get("project_type") ?? ""),
                            projectDate:
                              String(fd.get("project_date") ?? "") || null,
                            location: String(fd.get("location") ?? ""),
                            details: String(fd.get("details") ?? ""),
                            budget: String(fd.get("budget") ?? "") || null,
                          });
                          if (r.error) {
                            setFormError(r.error);
                            return;
                          }
                          setEditingProjectId(null);
                          router.refresh();
                        });
                      }}
                    >
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-[var(--muted)]">
                          Name
                        </span>
                        <input
                          name="name"
                          required
                          defaultValue={p.name}
                          className={inputCls}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[var(--muted)]">
                          Stage
                        </span>
                        <select
                          name="stage"
                          className={inputCls}
                          defaultValue={
                            stages.find(
                              (s) =>
                                honeyBookStageMatchKey(s) ===
                                honeyBookStageMatchKey(p.stage),
                            ) ?? (p.stage || "Inquiry")
                          }
                        >
                          {!stages.some(
                            (s) =>
                              honeyBookStageMatchKey(s) ===
                              honeyBookStageMatchKey(p.stage),
                          ) && p.stage ? (
                            <option value={p.stage}>
                              {formatHoneyBookStageLabel(p.stage)}
                            </option>
                          ) : null}
                          {stages.map((s) => (
                            <option key={s} value={s}>
                              {formatHoneyBookStageLabel(s)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[var(--muted)]">
                          Client
                        </span>
                        <select
                          name="client_id"
                          className={inputCls}
                          defaultValue={p.client_id ?? ""}
                        >
                          <option value="">—</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.full_name || c.email || c.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[var(--muted)]">
                          Type
                        </span>
                        <input
                          name="project_type"
                          defaultValue={p.project_type}
                          className={inputCls}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[var(--muted)]">
                          Date
                        </span>
                        <input
                          name="project_date"
                          type="date"
                          defaultValue={p.project_date ?? ""}
                          className={inputCls}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[var(--muted)]">
                          Location
                        </span>
                        <input
                          name="location"
                          defaultValue={p.location}
                          className={inputCls}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-[var(--muted)]">
                          Budget
                        </span>
                        <input
                          name="budget"
                          inputMode="decimal"
                          defaultValue={
                            p.budget != null && p.budget !== ""
                              ? String(p.budget)
                              : ""
                          }
                          className={inputCls}
                        />
                      </label>
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-[var(--muted)]">
                          Details
                        </span>
                        <textarea
                          name="details"
                          rows={2}
                          defaultValue={p.details}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                        />
                      </label>
                      {formError ? (
                        <p className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
                          {formError}
                        </p>
                      ) : null}
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          disabled={pending}
                          className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {pending ? "Saving…" : "Save project"}
                        </button>
                      </div>
                    </form>
                  ) : null}
                  {canAssign ? (
                    <ManagerAssigneePicker
                      project={p}
                      staffOptions={staffOptions}
                    />
                  ) : editable ? (
                    <StaffAssignRequest
                      project={p}
                      staffOptions={staffOptions}
                      currentProfileId={currentProfileId}
                    />
                  ) : null}
                  <ProjectQuestionnaireStaff
                    answers={p.questionnaire?.answers}
                    submittedAt={p.questionnaire?.submitted_at}
                  />
                  <ProjectFilesStaff
                    files={p.files ?? []}
                    canEdit={editable || canManage}
                  />
                  {p.details && editingProjectId !== p.id ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--foreground)]">
                      {p.details}
                    </p>
                  ) : null}
                  {(stageEventsByProject[p.id] ?? []).length > 0 ? (
                    <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                      {(stageEventsByProject[p.id] ?? []).map((ev) => (
                        <li key={ev.id}>
                          {ev.from_stage
                            ? `${formatHoneyBookStageLabel(ev.from_stage)} → ${formatHoneyBookStageLabel(ev.to_stage)}`
                            : `Set to ${formatHoneyBookStageLabel(ev.to_stage)}`}
                          {ev.changer_name ? ` · ${ev.changer_name}` : ""}
                          {" · "}
                          {new Date(ev.created_at).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "partnerships" ? (
        <PartnershipsPanel
          partnerships={partnershipProjects}
          financials={partnershipFinancials}
          isAdmin={isAdmin}
          canManage={canManage}
          currentProfileId={currentProfileId}
        />
      ) : null}

      {tab === "clients" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className={inputCls}
              placeholder="Search clients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {canManage ? (
            <button
              type="button"
              className="h-9 shrink-0 rounded-lg bg-[var(--brand)] px-3 text-sm font-medium text-white hover:opacity-90"
              onClick={() => {
                setFormError(null);
                setShowNewClient((v) => !v);
              }}
            >
              {showNewClient ? "Cancel" : "New client"}
            </button>
            ) : null}
          </div>
          {showNewClient ? (
            <Card>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                New Hub client
              </h3>
              <form
                className="mt-3 grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  setFormError(null);
                  startTransition(async () => {
                    const r = await createHoneyBookClientAction({
                      fullName: String(fd.get("full_name") ?? ""),
                      email: String(fd.get("email") ?? ""),
                      phone: String(fd.get("phone") ?? ""),
                      address: String(fd.get("address") ?? ""),
                    });
                    if (r.error) {
                      setFormError(r.error);
                      return;
                    }
                    setShowNewClient(false);
                    router.refresh();
                  });
                }}
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Name</span>
                  <input name="full_name" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Email</span>
                  <input name="email" type="email" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Phone</span>
                  <input name="phone" className={inputCls} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Address</span>
                  <input name="address" className={inputCls} />
                </label>
                {formError ? (
                  <p className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
                    {formError}
                  </p>
                ) : null}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Create client"}
                  </button>
                </div>
              </form>
            </Card>
          ) : null}
          {filteredClients.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No matching clients.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((c) => (
                    <Fragment key={c.id}>
                      <tr className="border-b border-[var(--border)] last:border-0">
                        <td className="px-4 py-3 text-[var(--foreground)]">
                          {c.full_name}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {c.email || "—"}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {c.phone || "—"}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {new Date(c.updated_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManage ? (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              className="text-sm text-[var(--brand)] hover:underline"
                              disabled={pending}
                              onClick={() => {
                                setFormError(null);
                                setShowNewClient(false);
                                setEditingClientId(
                                  editingClientId === c.id ? null : c.id,
                                );
                              }}
                            >
                              {editingClientId === c.id ? "Cancel" : "Edit"}
                            </button>
                            <button
                              type="button"
                              className="text-sm text-red-700 hover:underline dark:text-red-300"
                              disabled={pending}
                              onClick={() => {
                                if (
                                  !confirm(
                                    `Delete client “${c.full_name || c.email}”? Projects stay; they just unlink from this client.`,
                                  )
                                ) {
                                  return;
                                }
                                startTransition(async () => {
                                  const r = await deleteHoneyBookClientAction({
                                    id: c.id,
                                  });
                                  if (r.error) alert(r.error);
                                  else router.refresh();
                                });
                              }}
                            >
                              Delete
                            </button>
                          </div>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                      </tr>
                      {editingClientId === c.id ? (
                        <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                          <td colSpan={5} className="px-4 py-3">
                            <form
                              className="grid gap-3 sm:grid-cols-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const fd = new FormData(e.currentTarget);
                                setFormError(null);
                                startTransition(async () => {
                                  const r = await updateHoneyBookClientAction({
                                    id: c.id,
                                    fullName: String(fd.get("full_name") ?? ""),
                                    email: String(fd.get("email") ?? ""),
                                    phone: String(fd.get("phone") ?? ""),
                                    address: String(fd.get("address") ?? ""),
                                  });
                                  if (r.error) {
                                    setFormError(r.error);
                                    return;
                                  }
                                  setEditingClientId(null);
                                  router.refresh();
                                });
                              }}
                            >
                              <label className="block text-sm">
                                <span className="mb-1 block text-[var(--muted)]">
                                  Name
                                </span>
                                <input
                                  name="full_name"
                                  defaultValue={c.full_name}
                                  className={inputCls}
                                />
                              </label>
                              <label className="block text-sm">
                                <span className="mb-1 block text-[var(--muted)]">
                                  Email
                                </span>
                                <input
                                  name="email"
                                  type="email"
                                  defaultValue={c.email}
                                  className={inputCls}
                                />
                              </label>
                              <label className="block text-sm">
                                <span className="mb-1 block text-[var(--muted)]">
                                  Phone
                                </span>
                                <input
                                  name="phone"
                                  defaultValue={c.phone}
                                  className={inputCls}
                                />
                              </label>
                              <label className="block text-sm">
                                <span className="mb-1 block text-[var(--muted)]">
                                  Address
                                </span>
                                <input
                                  name="address"
                                  defaultValue={c.address}
                                  className={inputCls}
                                />
                              </label>
                              {formError ? (
                                <p className="text-sm text-red-700 sm:col-span-2 dark:text-red-300">
                                  {formError}
                                </p>
                              ) : null}
                              <div className="sm:col-span-2">
                                <button
                                  type="submit"
                                  disabled={pending}
                                  className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                                >
                                  {pending ? "Saving…" : "Save client"}
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "payments" ? (
        <div className="space-y-4">
          {isAdmin ? (
            <PaymentMatchReview
              payments={payments}
              projects={allProjects}
              clients={clients}
            />
          ) : null}
          {payments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No payments synced yet. Use the “New Payment Paid” Zapier trigger.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Paid</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    {isAdmin ? <th className="px-4 py-3 font-medium" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => (
                    <PaymentRow
                      key={pay.id}
                      pay={pay}
                      isAdmin={isAdmin}
                      clients={clients}
                      projects={allProjects}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "setup" ? (
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              How sync works
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              HoneyBook does not offer a public API we can poll. Zapier pushes
              events into the Hub.{" "}
              <strong className="font-medium text-[var(--foreground)]">
                Project Stage Changed
              </strong>{" "}
              is the important trigger so every stage (inquiry through completed)
              lands here — not only booked projects.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--foreground)]">
              <li>
                Set <code className="text-xs">HONEYBOOK_WEBHOOK_SECRET</code> in
                the Hub environment (and{" "}
                <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code>).
              </li>
              <li>
                In Zapier, create Zaps with HoneyBook triggers →{" "}
                <strong className="font-medium">Webhooks by Zapier → POST</strong>{" "}
                to <code className="text-xs">/api/webhooks/honeybook</code>.
              </li>
              <li>
                Auth header:{" "}
                <code className="text-xs">
                  Authorization: Bearer &lt;secret&gt;
                </code>{" "}
                (or <code className="text-xs">X-Webhook-Secret</code>).
              </li>
              <li>
                Map fields into JSON (nested or flat). Include{" "}
                <code className="text-xs">event</code> so we know the trigger.
              </li>
            </ol>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Recommended Zaps
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
              <li>
                <span className="text-[var(--foreground)]">
                  Project Stage Changed
                </span>{" "}
                → event <code className="text-xs">project.stage_changed</code>{" "}
                (all statuses)
              </li>
              <li>
                <span className="text-[var(--foreground)]">New Project Booked</span>{" "}
                → <code className="text-xs">project.booked</code>
              </li>
              <li>
                <span className="text-[var(--foreground)]">Client Created</span> /{" "}
                <span className="text-[var(--foreground)]">New Inquiry</span> →{" "}
                <code className="text-xs">client.created</code> /{" "}
                <code className="text-xs">inquiry.created</code>
              </li>
              <li>
                <span className="text-[var(--foreground)]">New Payment Paid</span>{" "}
                → <code className="text-xs">payment.paid</code>
              </li>
              <li>
                <span className="text-[var(--foreground)]">
                  Task Created / Updated / Completed
                </span>{" "}
                → <code className="text-xs">task.created</code> /{" "}
                <code className="text-xs">task.updated</code> /{" "}
                <code className="text-xs">task.completed</code> (shows on My
                Week for the assignee)
              </li>
            </ul>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-[var(--background)] p-4 text-xs text-[var(--foreground)]">
{`{
  "event": "project.stage_changed",
  "client": {
    "external_id": "{{Client ID}}",
    "full_name": "{{Client Full Name}}",
    "email": "{{Client Email}}",
    "phone": "{{Phone Number}}"
  },
  "project": {
    "external_id": "{{Project ID}}",
    "name": "{{Project Name}}",
    "stage": "{{Project Stage}}",
    "project_type": "{{Project Type}}",
    "project_date": "{{Project Date}}",
    "budget": "{{Project Budget}}",
    "location": "{{Project Location}}",
    "details": "{{Project Details}}"
  }
}`}
            </pre>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Payment Zap sample (New Payment Paid)
            </p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-[var(--background)] p-4 text-xs text-[var(--foreground)]">
{`{
  "event": "payment.paid",
  "client": { "email": "{{Client Email}}", "full_name": "{{Client Full Name}}" },
  "project": { "external_id": "{{Project ID}}", "name": "{{Project Name}}" },
  "payment": {
    "external_id": "{{Payment ID}}",
    "amount": "{{Payment Amount}}",
    "paid_at": "{{Payment Date}}",
    "note": "{{Payment Note}}"
  }
}`}
            </pre>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Task Zap sample
            </p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-[var(--background)] p-4 text-xs text-[var(--foreground)]">
{`{
  "event": "task.created",
  "task": {
    "external_id": "{{Task ID}}",
    "title": "{{Task Title}}",
    "due_date": "{{Due Date}}",
    "status": "open",
    "assignee_email": "{{Assignee Email}}",
    "assignee_name": "{{Assignee Name}}",
    "project_id": "{{Project ID}}",
    "project_name": "{{Project Name}}",
    "notes": "{{Task Notes}}"
  }
}`}
            </pre>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Field names vary slightly in Zapier — map whatever HoneyBook
              exposes. External IDs keep updates idempotent. Match{" "}
              <code className="text-xs">assignee_email</code> to the Hub People
              email so the task appears on that person’s My Week.
            </p>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Historical backfill (CSV)
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Zapier only fires on new events. Export HoneyBook’s{" "}
              <strong className="font-medium text-[var(--foreground)]">
                Projects
              </strong>{" "}
              report (Reports → Download reports), then paste the CSV below.
              The Hub understands HoneyBook columns like{" "}
              <code className="text-xs">Project Name</code>,{" "}
              <code className="text-xs">Client Info</code>,{" "}
              <code className="text-xs">Booked (yes/no)</code>,{" "}
              <code className="text-xs">Project Date</code>, and{" "}
              <code className="text-xs">Total Project Value</code>.
            </p>
            <textarea
              className="mt-3 min-h-[140px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              placeholder="Paste the HoneyBook Projects report CSV here (include the header row)…"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pending || !csvText.trim()}
                onClick={runImport}
                className="h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "Importing…" : "Import CSV"}
              </button>
              {importMsg ? (
                <p className="text-sm text-[var(--muted)]">{importMsg}</p>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
    </>
  );
}
