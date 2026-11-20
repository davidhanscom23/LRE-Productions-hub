"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  linkTagAction,
  lookupTagAction,
  reviewGearRequestAction,
  scanTagAction,
  suggestGearChangeAction,
  updateUnitAction,
  type GearActionResult,
  type LookupResult,
} from "@/app/(app)/gear-scan/actions";
import { QrScanner } from "@/components/gear-scan/qr-scanner";
import { formatTag, parseTagCode } from "@/lib/gear-tags/parse";
import {
  dequeue,
  enqueue,
  newClientId,
  readQueue,
  writeQueue,
  type QueuedScan,
} from "@/lib/gear-tags/queue";
import {
  OWNER_LABELS,
  type GearBoard,
  type GearRequestKind,
  type OwnerCompany,
  type ScanDirection,
  type ScanFlag,
  type TaggedUnit,
} from "@/lib/gear-tags/types";

type Props = { board: GearBoard; initialTag: string; initialProjectId: string };
type Tab = "scan" | "out" | "gear" | "requests";
type Mode = ScanDirection | "lookup";
type Found = Extract<LookupResult, { status: "found" }>;
type Banner = { tone: "ok" | "warn" | "error"; text: string } | null;
type LogLine = { id: string; ok: boolean; text: string };

const NO_EVENT = "none";
const field =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";
const card = "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4";
const primaryBtn =
  "rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const quietBtn =
  "rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50";
const OWNERS: OwnerCompany[] = ["vident", "lukesent", "lre"];

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function unitName(u: Pick<TaggedUnit, "productName" | "label">): string {
  return u.label ? `${u.productName} (${u.label})` : u.productName;
}

function StatusPill({ unit }: { unit: TaggedUnit }) {
  const tone =
    unit.status === "out"
      ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      : unit.status === "retired"
        ? "border-[var(--border)] text-[var(--muted)]"
        : "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100";
  const text = unit.status === "out" ? "Out" : unit.status === "retired" ? "Retired" : "In";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>{text}</span>;
}

export function GearScanClient({ board, initialTag, initialProjectId }: Props) {
  const router = useRouter();
  const { units, products, projects, requests, isAdmin } = board;

  const [tab, setTab] = useState<Tab>("scan");
  const [mode, setMode] = useState<Mode>(initialTag ? "lookup" : "out");
  const [projectId, setProjectId] = useState(initialProjectId);
  const [flag, setFlag] = useState<ScanFlag>("none");
  const [note, setNote] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [unlinked, setUnlinked] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [filter, setFilter] = useState("");
  const busyRef = useRef(false);

  const byTag = useMemo(() => new Map(units.filter((u) => u.tag).map((u) => [u.tag as string, u])), [units]);
  const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const stillOut = useMemo(() => units.filter((u) => u.status === "out"), [units]);
  const tagged = useMemo(() => units.filter((u) => u.tag), [units]);
  const pending = requests.filter((r) => r.status === "pending");
  const eventId = projectId && projectId !== NO_EVENT ? projectId : null;

  const addLog = useCallback((ok: boolean, text: string) => {
    setLog((l) => [{ id: newClientId(), ok, text }, ...l].slice(0, 12));
  }, []);

  const lookup = useCallback(async (tag: string) => {
    setBusy(true);
    busyRef.current = true;
    setBanner(null);
    try {
      const res = await lookupTagAction(tag);
      if (res.status === "found") {
        setFound(res);
        setUnlinked(null);
      } else if (res.status === "unlinked") {
        setFound(null);
        setUnlinked(res.tag);
      } else {
        setBanner({ tone: "error", text: res.error });
      }
    } catch {
      setBanner({ tone: "error", text: "No signal. Looking up a tag needs a connection. Check out and Check in still work offline." });
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }, []);

  /** Send one scan. Returns "sent", "retry" (no connection, keep it) or "dropped" (the hub refused it). */
  const send = useCallback(
    async (scan: QueuedScan, replay: boolean): Promise<"sent" | "retry" | "dropped"> => {
      let res;
      try {
        res = await scanTagAction(scan);
      } catch {
        return "retry";
      }
      const verb = scan.direction === "out" ? "Checked out" : "Checked in";
      if (res.ok) {
        const extra = res.moved > 1 ? ` and ${res.moved - 1} piece${res.moved === 2 ? "" : "s"} inside` : "";
        const where = res.projectName ? (scan.direction === "out" ? ` to ${res.projectName}` : ` from ${res.projectName}`) : "";
        const text = `${verb}: ${unitName(res.unit)}${extra}${where}.`;
        addLog(true, replay ? `${text} (sent from this phone's saved scans)` : text);
        if (!replay) {
          setBanner({
            tone: res.warnings.length ? "warn" : "ok",
            text: [text, ...res.warnings].join(" "),
          });
          setFound(null);
          setUnlinked(null);
        }
        return "sent";
      }
      if (res.code === "unlinked") {
        addLog(false, `Tag ${res.tag} is not linked to any gear yet. Nothing was recorded.`);
        if (!replay) {
          setFound(null);
          setUnlinked(res.tag);
          setBanner({ tone: "warn", text: `Tag ${res.tag} is new. Link it to a piece of gear below, then scan it again.` });
        }
        return "dropped";
      }
      addLog(false, `Tag ${scan.raw}: ${res.error}`);
      if (!replay) setBanner({ tone: "error", text: res.error });
      return "dropped";
    },
    [addLog],
  );

  const flush = useCallback(async () => {
    let list = readQueue(window.localStorage);
    if (list.length === 0) {
      setQueue([]);
      return;
    }
    for (const scan of [...list]) {
      const outcome = await send(scan, true);
      if (outcome === "retry") break;
      list = dequeue(list, scan.clientId);
      writeQueue(window.localStorage, list);
    }
    setQueue(list);
    router.refresh();
  }, [router, send]);

  useEffect(() => {
    const start = window.setTimeout(() => {
      setQueue(readQueue(window.localStorage));
      if (navigator.onLine) void flush();
      if (initialTag) void lookup(initialTag);
    }, 0);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(start);
      window.removeEventListener("online", onOnline);
    };
  }, [flush, initialTag, lookup]);

  const scan = useCallback(
    async (tag: string, direction: ScanDirection) => {
      if (direction === "out" && !projectId) {
        setBanner({ tone: "warn", text: "Pick the event this gear is going to first, or choose No event." });
        return;
      }
      const item: QueuedScan = {
        clientId: newClientId(),
        raw: tag,
        direction,
        projectId: direction === "out" ? eventId : null,
        flag,
        note: note.trim(),
        scannedAt: new Date().toISOString(),
      };
      setBusy(true);
      busyRef.current = true;
      setBanner(null);
      const outcome = navigator.onLine ? await send(item, false) : "retry";
      if (outcome === "retry") {
        const list = enqueue(readQueue(window.localStorage), item);
        const saved = writeQueue(window.localStorage, list);
        setQueue(list);
        const known = byTag.get(tag);
        const name = known ? unitName(known) : `tag ${tag}`;
        setBanner(
          saved
            ? { tone: "warn", text: `No signal. Saved on this phone: ${name}. It will send by itself when you are back online.` }
            : { tone: "error", text: `No signal, and this phone could not save the scan. Write down tag ${tag} and scan it again later.` },
        );
      } else if (outcome === "sent") {
        setFlag("none");
        setNote("");
        router.refresh();
      }
      setBusy(false);
      busyRef.current = false;
    },
    [byTag, eventId, flag, note, projectId, router, send],
  );

  const onCode = useCallback(
    (raw: string) => {
      if (busyRef.current) return;
      const tag = parseTagCode(raw);
      if (!tag) {
        setBanner({ tone: "warn", text: "That is not an LRE gear tag. Point the camera at the tag on the gear." });
        return;
      }
      if (mode === "lookup") void lookup(tag);
      else void scan(tag, mode);
    },
    [lookup, mode, scan],
  );

  function onTyped(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = typed;
    setTyped("");
    onCode(value);
  }

  async function run(action: () => Promise<GearActionResult>, after?: () => void) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await action();
      if (res.ok) {
        setBanner({ tone: "ok", text: res.message ?? "Saved." });
        after?.();
        router.refresh();
      } else {
        setBanner({ tone: "error", text: res.error });
      }
    } catch {
      setBanner({ tone: "error", text: "No signal. Try again when you are back online." });
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "scan", label: "Scan" },
    { id: "out", label: `Still out (${stillOut.length})` },
    { id: "gear", label: `Tagged gear (${tagged.length})` },
    { id: "requests", label: `Requests (${pending.length})` },
  ];

  const bannerTone =
    banner?.tone === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
      : banner?.tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100";

  const q = filter.trim().toLowerCase();
  const visibleGear = tagged.filter(
    (u) =>
      !q ||
      (u.tag ?? "").includes(q) ||
      u.productName.toLowerCase().includes(q) ||
      u.label.toLowerCase().includes(q) ||
      u.serial.toLowerCase().includes(q),
  );

  const outGroups = new Map<string, { name: string; projectId: string | null; units: TaggedUnit[] }>();
  for (const u of stillOut) {
    const key = u.outProjectId ?? NO_EVENT;
    const group = outGroups.get(key) ?? { name: u.outProjectName || "No event", projectId: u.outProjectId, units: [] };
    group.units.push(u);
    outGroups.set(key, group);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold">Gear scan</h1>
        <p className="text-sm text-[var(--muted)]">
          Scan the LRE tag on a piece of gear to check it out to an event or back in.
        </p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {queue.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <span>
            {queue.length} scan{queue.length === 1 ? "" : "s"} saved on this phone, waiting for a signal.
          </span>
          <button type="button" onClick={() => void flush()} className="font-semibold underline">
            Send now
          </button>
        </div>
      ) : null}

      {banner ? (
        <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${bannerTone}`}>
          {banner.text}
        </p>
      ) : null}

      {tab === "scan" ? (
        <>
          <div className={`${card} space-y-3`}>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["out", "Check out"],
                  ["back", "Check in"],
                  ["lookup", "Look up"],
                ] as [Mode, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  onClick={() => setMode(id)}
                  className={`rounded-lg border px-2 py-2 text-sm font-semibold ${
                    mode === id
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--border)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "out" ? (
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Event the gear is going to</span>
                <select id="gear-scan-event" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
                  <option value="">Pick an event…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.date ? `${p.date} · ` : ""}
                      {p.name}
                    </option>
                  ))}
                  <option value={NO_EVENT}>No event (just leaving the warehouse)</option>
                </select>
              </label>
            ) : null}
            {mode === "back" ? (
              <p className="text-sm text-[var(--muted)]">
                No event to pick. Each piece remembers the event it went out to.
              </p>
            ) : null}
            {mode === "lookup" ? (
              <p className="text-sm text-[var(--muted)]">Shows what a tag is on and where it has been. Changes nothing.</p>
            ) : null}

            {mode !== "lookup" ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-[var(--muted)]">
                  Damaged or missing? Add it to the next scan{flag !== "none" || note ? " (set)" : ""}
                </summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr]">
                  <select
                    id="gear-scan-flag"
                    aria-label="Condition"
                    value={flag}
                    onChange={(e) => setFlag(e.target.value as ScanFlag)}
                    className={field}
                  >
                    <option value="none">No problem</option>
                    <option value="damaged">Damaged</option>
                    <option value="missing">Missing parts</option>
                  </select>
                  <input
                    id="gear-scan-note"
                    aria-label="Note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Note (optional)"
                    maxLength={500}
                    className={field}
                  />
                </div>
              </details>
            ) : null}

            <QrScanner onCode={onCode} paused={busy} />

            <form onSubmit={onTyped} className="flex gap-2">
              <input
                id="gear-scan-typed"
                aria-label="Tag number"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                inputMode="numeric"
                placeholder="Or type the tag number"
                className={field}
              />
              <button type="submit" disabled={busy || !typed.trim()} className={quietBtn}>
                Go
              </button>
            </form>
          </div>

          {unlinked ? (
            <LinkTagCard
              key={unlinked}
              tag={unlinked}
              products={products}
              isAdmin={isAdmin}
              busy={busy}
              onSubmit={(input) =>
                run(
                  () => linkTagAction(unlinked, input),
                  () => setUnlinked(null),
                )
              }
              onCancel={() => setUnlinked(null)}
            />
          ) : null}

          {found ? (
            <UnitCard
              key={found.unit.id}
              found={found}
              caseUnit={found.unit.caseUnitId ? (byId.get(found.unit.caseUnitId) ?? null) : null}
              isAdmin={isAdmin}
              busy={busy}
              eventName={eventId ? (projects.find((p) => p.id === eventId)?.name ?? "") : ""}
              onCheckOut={() => found.unit.tag && void scan(found.unit.tag, "out")}
              onCheckIn={() => found.unit.tag && void scan(found.unit.tag, "back")}
              onSave={(edit) =>
                run(
                  () => updateUnitAction(found.unit.id, edit),
                  () => found.unit.tag && void lookup(edit.newTag ? (parseTagCode(edit.newTag) ?? found.unit.tag) : found.unit.tag),
                )
              }
              onSuggest={(kind, details) =>
                run(() => suggestGearChangeAction({ kind, unitId: found.unit.id, details }))
              }
              onClose={() => setFound(null)}
            />
          ) : null}

          {log.length > 0 ? (
            <div className={card}>
              <p className="text-sm font-semibold">This session</p>
              <ul className="mt-2 space-y-1 text-sm">
                {log.map((l) => (
                  <li key={l.id} className={l.ok ? "" : "text-red-700 dark:text-red-300"}>
                    {l.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "out" ? (
        <div className="space-y-3">
          {outGroups.size === 0 ? (
            <p className={`${card} text-center text-sm text-[var(--muted)]`}>Every tagged piece is checked in.</p>
          ) : (
            [...outGroups.entries()].map(([key, group]) => (
              <div key={key} className={card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {group.name} · {group.units.length}
                  </p>
                  {group.projectId ? (
                    <Link href={`/event-checklist/${group.projectId}`} className="text-sm text-[var(--brand)] hover:underline">
                      Open checklist
                    </Link>
                  ) : null}
                </div>
                <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
                  {group.units.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        {unitName(u)} <span className="text-[var(--muted)]">· {formatTag(u.tag)}</span>
                      </span>
                      <span className="text-xs text-[var(--muted)]">out since {when(u.outSince)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "gear" ? (
        <div className="space-y-3">
          <input
            id="gear-scan-filter"
            aria-label="Filter tagged gear"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by tag, item, label or serial"
            className={field}
          />
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {visibleGear.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                {tagged.length === 0
                  ? "No tags linked yet. On the Scan tab, scan a new tag to link it to a piece of gear."
                  : "Nothing matches."}
              </li>
            ) : (
              visibleGear.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("scan");
                      setMode("lookup");
                      if (u.tag) void lookup(u.tag);
                    }}
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
                  >
                    <span>
                      <span className="font-medium">{unitName(u)}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {formatTag(u.tag)} · {OWNER_LABELS[u.owner]}
                        {u.isCase ? " · Case" : ""}
                        {u.status === "out" && u.outProjectName ? ` · at ${u.outProjectName}` : ""}
                      </span>
                    </span>
                    <StatusPill unit={u} />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {tab === "requests" ? (
        <RequestsTab
          board={board}
          busy={busy}
          onSuggest={(kind, details, done) => run(() => suggestGearChangeAction({ kind, details }), done)}
          onReview={(id, approve, reviewNote) => run(() => reviewGearRequestAction({ id, approve, note: reviewNote }))}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

type LinkInput = Parameters<typeof linkTagAction>[1];

function LinkTagCard(props: {
  tag: string;
  products: GearBoard["products"];
  isAdmin: boolean;
  busy: boolean;
  onSubmit: (input: LinkInput) => void;
  onCancel: () => void;
}) {
  const { tag, products, isAdmin, busy } = props;
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [label, setLabel] = useState("");
  const [serial, setSerial] = useState("");
  const [owner, setOwner] = useState<OwnerCompany | "">("");
  const [isCase, setIsCase] = useState(false);
  const [caseTag, setCaseTag] = useState("");

  const s = search.trim().toLowerCase();
  const shown = s ? products.filter((p) => p.name.toLowerCase().includes(s) || p.id === productId) : products;

  return (
    <form
      className={`${card} space-y-3`}
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit({ productId, label, serial, isCase, caseTag: isCase ? "" : caseTag, owner });
      }}
    >
      <div>
        <p className="font-semibold">Tag {tag} is new</p>
        <p className="text-sm text-[var(--muted)]">
          {isAdmin
            ? "Tell the hub which piece of gear it is on."
            : "Tell the hub which piece of gear it is on. An admin approves it before it goes live."}
        </p>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Find the item</span>
        <input id="gear-link-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type part of the name" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Inventory item</span>
        <select
          id="gear-link-product"
          required
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            const p = products.find((x) => x.id === e.target.value);
            if (p && !owner) setOwner(p.owner);
          }}
          className={field}
        >
          <option value="">Pick one…</option>
          {shown.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Name for this one piece (optional)</span>
          <input id="gear-link-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Speaker 3" maxLength={80} className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Serial number (optional)</span>
          <input id="gear-link-serial" value={serial} onChange={(e) => setSerial(e.target.value)} className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Owner</span>
          <select id="gear-link-owner" value={owner} onChange={(e) => setOwner(e.target.value as OwnerCompany | "")} className={field}>
            <option value="">Same as the inventory item</option>
            {OWNERS.map((o) => (
              <option key={o} value={o}>
                {OWNER_LABELS[o]}
              </option>
            ))}
          </select>
        </label>
        {!isCase ? (
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Lives in case (tag number, optional)</span>
            <input id="gear-link-case" value={caseTag} onChange={(e) => setCaseTag(e.target.value)} inputMode="numeric" placeholder="0002" className={field} />
          </label>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input id="gear-link-iscase" type="checkbox" checked={isCase} onChange={(e) => setIsCase(e.target.checked)} />
        This tag is on a case, rack or bin
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !productId} className={primaryBtn}>
          {isAdmin ? "Link tag" : "Send to an admin"}
        </button>
        <button type="button" onClick={props.onCancel} className={quietBtn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type EditInput = Parameters<typeof updateUnitAction>[1];

function UnitCard(props: {
  found: Found;
  caseUnit: TaggedUnit | null;
  isAdmin: boolean;
  busy: boolean;
  eventName: string;
  onCheckOut: () => void;
  onCheckIn: () => void;
  onSave: (edit: EditInput) => void;
  onSuggest: (kind: GearRequestKind, details: string) => void;
  onClose: () => void;
}) {
  const { found, caseUnit, isAdmin, busy, eventName } = props;
  const { unit, contents, history } = found;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(unit.label);
  const [serial, setSerial] = useState(unit.serial);
  const [owner, setOwner] = useState<OwnerCompany>(unit.owner);
  const [isCase, setIsCase] = useState(unit.isCase);
  const [caseTag, setCaseTag] = useState(caseUnit?.tag ?? "");
  const [retired, setRetired] = useState(unit.status === "retired");
  const [newTag, setNewTag] = useState("");
  const [kind, setKind] = useState<GearRequestKind>("change");
  const [details, setDetails] = useState("");

  return (
    <div className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{unitName(unit)}</p>
          <p className="text-sm text-[var(--muted)]">
            {formatTag(unit.tag)} · {OWNER_LABELS[unit.owner]}
            {unit.isCase ? " · Case" : ""}
            {caseUnit ? ` · lives in ${unitName(caseUnit)} (${formatTag(caseUnit.tag)})` : ""}
          </p>
          {unit.status === "out" ? (
            <p className="mt-1 text-sm">
              Out{unit.outProjectName ? ` to ${unit.outProjectName}` : ""} since {when(unit.outSince)}
            </p>
          ) : null}
        </div>
        <StatusPill unit={unit} />
      </div>

      {unit.status !== "retired" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={props.onCheckOut} className={primaryBtn}>
            Check out{eventName ? ` to ${eventName}` : ""}
          </button>
          <button type="button" disabled={busy} onClick={props.onCheckIn} className={quietBtn}>
            Check in
          </button>
          <button type="button" onClick={props.onClose} className={quietBtn}>
            Close
          </button>
        </div>
      ) : null}

      {contents.length > 0 ? (
        <div>
          <p className="text-sm font-semibold">In this case ({contents.length})</p>
          <ul className="mt-1 text-sm text-[var(--muted)]">
            {contents.map((c) => (
              <li key={c.id}>
                {unitName(c)} · {formatTag(c.tag)} · {c.status === "out" ? "Out" : "In"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="text-sm font-semibold">History</p>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No scans yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                <span className="font-medium">{h.direction === "out" ? "Out" : "In"}</span>
                {h.projectName ? ` · ${h.projectName}` : ""} · {when(h.scannedAt)} · {h.scannedByName}
                {h.viaCase ? " · with its case" : ""}
                {h.flag !== "none" ? ` · ${h.flag === "damaged" ? "Damaged" : "Missing parts"}` : ""}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin ? (
        editing ? (
          <form
            className="space-y-3 border-t border-[var(--border)] pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              props.onSave({ label, serial, owner, isCase, caseTag: isCase ? "" : caseTag, retired, newTag });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Name for this piece</span>
                <input id="gear-edit-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} className={field} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Serial number</span>
                <input id="gear-edit-serial" value={serial} onChange={(e) => setSerial(e.target.value)} className={field} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Owner</span>
                <select id="gear-edit-owner" value={owner} onChange={(e) => setOwner(e.target.value as OwnerCompany)} className={field}>
                  {OWNERS.map((o) => (
                    <option key={o} value={o}>
                      {OWNER_LABELS[o]}
                    </option>
                  ))}
                </select>
              </label>
              {!isCase ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-[var(--muted)]">Lives in case (tag number)</span>
                  <input id="gear-edit-case" value={caseTag} onChange={(e) => setCaseTag(e.target.value)} inputMode="numeric" className={field} />
                </label>
              ) : null}
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Replace the sticker (new tag number)</span>
                <input id="gear-edit-newtag" value={newTag} onChange={(e) => setNewTag(e.target.value)} inputMode="numeric" placeholder="Leave blank to keep" className={field} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input id="gear-edit-iscase" type="checkbox" checked={isCase} onChange={(e) => setIsCase(e.target.checked)} />
              This tag is on a case, rack or bin
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input id="gear-edit-retired" type="checkbox" checked={retired} onChange={(e) => setRetired(e.target.checked)} />
              Retired (sold, lost or scrapped). It keeps its history and can no longer be scanned out.
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primaryBtn}>
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className={quietBtn}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-[var(--brand)] hover:underline">
            Edit this piece
          </button>
        )
      ) : (
        <form
          className="space-y-2 border-t border-[var(--border)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            props.onSuggest(kind, details);
            setDetails("");
          }}
        >
          <p className="text-sm font-semibold">Suggest a change</p>
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <select id="gear-suggest-kind" aria-label="Kind of change" value={kind} onChange={(e) => setKind(e.target.value as GearRequestKind)} className={field}>
              <option value="change">Change it</option>
              <option value="remove">Remove it</option>
            </select>
            <input id="gear-suggest-details" aria-label="What should change" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What should change, and why" maxLength={1000} className={field} />
          </div>
          <button type="submit" disabled={busy || details.trim().length < 3} className={quietBtn}>
            Send to an admin
          </button>
        </form>
      )}
    </div>
  );
}

function RequestsTab(props: {
  board: GearBoard;
  busy: boolean;
  onSuggest: (kind: GearRequestKind, details: string, done: () => void) => void;
  onReview: (id: string, approve: boolean, note: string) => void;
}) {
  const { board, busy } = props;
  const [kind, setKind] = useState<GearRequestKind>("add");
  const [details, setDetails] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = board.requests.filter((r) => r.status === "pending");
  const reviewed = board.requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-3">
      <form
        className={`${card} space-y-2`}
        onSubmit={(e) => {
          e.preventDefault();
          props.onSuggest(kind, details, () => setDetails(""));
        }}
      >
        <p className="font-semibold">Suggest an addition, change or removal</p>
        <p className="text-sm text-[var(--muted)]">
          {board.isAdmin
            ? "Staff suggestions land below for you to approve. You can also leave yourself a note here."
            : "Anyone on staff can suggest. An admin approves it before anything changes."}
        </p>
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <select id="gear-request-kind" aria-label="Kind of change" value={kind} onChange={(e) => setKind(e.target.value as GearRequestKind)} className={field}>
            <option value="add">Add gear</option>
            <option value="change">Change gear</option>
            <option value="remove">Remove gear</option>
          </select>
          <input id="gear-request-details" aria-label="Details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Which gear, and what should change" maxLength={1000} className={field} />
        </div>
        <button type="submit" disabled={busy || details.trim().length < 3} className={primaryBtn}>
          Send
        </button>
      </form>

      <div className={card}>
        <p className="font-semibold">Waiting for an admin ({pending.length})</p>
        {pending.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--muted)]">Nothing waiting.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {pending.map((r) => (
              <li key={r.id} className="space-y-2 py-3 text-sm">
                <p className="font-medium">{r.summary}</p>
                {r.details ? <p>{r.details}</p> : null}
                <p className="text-xs text-[var(--muted)]">
                  {r.requestedByName} · {when(r.requestedAt)}
                </p>
                {board.isAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    <input
                      id={`gear-review-note-${r.id}`}
                      aria-label="Note back to them"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Note back (optional)"
                      maxLength={500}
                      className={`${field} sm:max-w-xs`}
                    />
                    <button type="button" disabled={busy} onClick={() => props.onReview(r.id, true, notes[r.id] ?? "")} className={primaryBtn}>
                      Approve
                    </button>
                    <button type="button" disabled={busy} onClick={() => props.onReview(r.id, false, notes[r.id] ?? "")} className={quietBtn}>
                      Decline
                    </button>
                  </div>
                ) : null}
                {board.isAdmin && r.kind !== "link_tag" ? (
                  <p className="text-xs text-[var(--muted)]">
                    Approving records your decision. Make the edit itself on the piece (Tagged gear tab) or in AV Catalog.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {reviewed.length > 0 ? (
        <div className={card}>
          <p className="font-semibold">Reviewed</p>
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {reviewed.map((r) => (
              <li key={r.id} className="py-2">
                <span className="font-medium">{r.status === "approved" ? "Approved" : "Declined"}:</span> {r.summary}
                {r.details ? ` · ${r.details}` : ""}
                {r.reviewNote ? ` · Admin note: ${r.reviewNote}` : ""}
                <span className="block text-xs text-[var(--muted)]">
                  {r.requestedByName} · {when(r.requestedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
