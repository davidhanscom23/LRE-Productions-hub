"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Send,
  X,
} from "lucide-react";

const DEPARTMENTS = [
  "Audiovisual",
  "Corporate",
  "Wedding & Social",
  "Golf",
  "Office",
] as const;

type Recipient = {
  id: string;
  name: string;
  phone: string | null;
  hasPhone: boolean;
  email: string | null;
  hasEmail: boolean;
  departments: string[];
};

type Conversation = {
  contactPhone: string;
  staffId: string | null;
  staffName: string | null;
  lastBody: string;
  lastAt: string;
  lastDirection: "outbound" | "inbound";
};

type Message = {
  id: string;
  direction: "outbound" | "inbound";
  body: string;
  status: string | null;
  createdAt: string;
};

type Modal = null | "single" | "bulkSms" | "bulkEmail";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function segInfo(text: string): string {
  const n = text.length;
  const segs = n === 0 ? 0 : Math.ceil(n / 160);
  return `${n} character${n === 1 ? "" : "s"}${segs > 1 ? ` · ${segs} segments` : ""}`;
}

export function SmsPortalClient() {
  const [configured, setConfigured] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    try {
      const r = await fetch("/api/sms/conversations");
      const d = await r.json();
      setConfigured(Boolean(d.configured));
      setConversations((d.conversations as Conversation[]) ?? []);
    } catch {
      /* ignore transient errors */
    }
  }

  async function loadRecipients() {
    try {
      const r = await fetch("/api/sms/recipients");
      const d = await r.json();
      setRecipients((d.recipients as Recipient[]) ?? []);
    } catch {
      /* ignore */
    }
  }

  async function loadThread(phone: string) {
    try {
      const r = await fetch(`/api/sms/thread?phone=${encodeURIComponent(phone)}`);
      const d = await r.json();
      setThread((d.messages as Message[]) ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const first = setTimeout(() => {
      void loadConversations();
      void loadRecipients();
    }, 0);
    const t = setInterval(() => void loadConversations(), 12000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const first = setTimeout(() => void loadThread(selected), 0);
    const t = setInterval(() => void loadThread(selected), 10000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [selected]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [thread]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.contactPhone.toLowerCase().includes(q) ||
        (c.staffName ?? "").toLowerCase().includes(q) ||
        c.lastBody.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const selectedConv = conversations.find((c) => c.contactPhone === selected) ?? null;

  async function sendReply() {
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: selected, message: reply }),
      });
      if (r.ok) {
        setReply("");
        await loadThread(selected);
        await loadConversations();
      }
    } finally {
      setBusy(false);
    }
  }

  const showListOnMobile = !selected;
  const showThreadOnMobile = Boolean(selected);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7.5rem)] max-w-6xl flex-col px-3 py-4 sm:min-h-0 sm:px-4 sm:py-6">
      <div
        className={`mb-3 shrink-0 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:mb-4 sm:p-4 ${
          showThreadOnMobile ? "hidden md:block" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)]">
            <MessageSquare className="h-5 w-5 text-[var(--brand)]" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--foreground)]">
              SMS Portal
            </h1>
            <p className="text-xs text-[var(--muted)]">
              {conversations.length} conversation
              {conversations.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setModal("single")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base font-medium hover:bg-[var(--surface-hover)] sm:py-1.5 sm:text-sm"
          >
            <Send className="h-4 w-4 shrink-0" />
            Single SMS
          </button>
          <button
            type="button"
            onClick={() => setModal("bulkSms")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-2.5 text-base font-medium text-emerald-600 hover:bg-emerald-500/10 sm:py-1.5 sm:text-sm dark:text-emerald-400"
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            Bulk SMS
          </button>
          <button
            type="button"
            onClick={() => setModal("bulkEmail")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-500/40 px-3 py-2.5 text-base font-medium text-indigo-600 hover:bg-indigo-500/10 sm:py-1.5 sm:text-sm dark:text-indigo-400"
          >
            <Mail className="h-4 w-4 shrink-0" />
            Bulk Email
          </button>
        </div>
      </div>

      {!configured ? (
        <div className="mb-3 shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 sm:mb-4 dark:text-amber-300">
          Twilio isn&apos;t connected yet. Add <code>TWILIO_ACCOUNT_SID</code>,{" "}
          <code>TWILIO_AUTH_TOKEN</code>, and <code>TWILIO_FROM_NUMBER</code> to
          send and receive texts. Bulk Email works without it.
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[320px_1fr] md:gap-4">
        {/* Conversation list — fills remaining viewport on mobile */}
        <div
          className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 ${
            showListOnMobile ? "flex flex-1" : "hidden md:flex"
          }`}
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="mb-2 w-full shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-base sm:py-2 sm:text-sm"
          />
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain md:max-h-[60vh]">
            {filtered.length === 0 ? (
              <p className="px-2 py-10 text-center text-sm text-[var(--muted)]">
                No messages yet
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {filtered.map((c) => (
                  <li key={c.contactPhone}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.contactPhone)}
                      className={`w-full px-3 py-3 text-left hover:bg-[var(--surface-hover)] sm:rounded-lg sm:py-2.5 ${
                        selected === c.contactPhone
                          ? "bg-[var(--surface-hover)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-[var(--foreground)]">
                          {c.staffName || c.contactPhone}
                        </span>
                        <span className="shrink-0 text-[10px] text-[var(--muted)]">
                          {fmtTime(c.lastAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {c.lastDirection === "outbound" ? "You: " : ""}
                        {c.lastBody}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Thread — full-height on mobile when a conversation is selected */}
        <div
          className={`min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] md:flex md:min-h-[60vh] ${
            showThreadOnMobile ? "flex flex-1" : "hidden"
          }`}
        >
          {selected ? (
            <>
              <div className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                    {selectedConv?.staffName || selected}
                  </p>
                  {selectedConv?.staffName ? (
                    <p className="truncate text-xs text-[var(--muted)]">
                      {selected}
                    </p>
                  ) : null}
                </div>
              </div>
              <div
                ref={threadRef}
                className="flex-1 space-y-2 overflow-auto px-3 py-3 sm:px-4"
              >
                {thread.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[75%] ${
                        m.direction === "outbound"
                          ? "bg-[var(--brand)] text-white"
                          : "bg-[var(--surface-hover)] text-[var(--foreground)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={`mt-0.5 text-[10px] ${
                          m.direction === "outbound"
                            ? "text-white/70"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {fmtTime(m.createdAt)}
                        {m.direction === "outbound" && m.status
                          ? ` · ${m.status}`
                          : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                  placeholder="Type a reply…"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm sm:py-2"
                />
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={busy || !reply.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:py-2"
                  aria-label="Send reply"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[var(--muted)]">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>

      {modal === "single" ? (
        <SingleModal
          recipients={recipients}
          onClose={() => setModal(null)}
          onSent={() => {
            setModal(null);
            void loadConversations();
          }}
        />
      ) : null}
      {modal === "bulkSms" ? (
        <BulkSmsModal
          recipients={recipients}
          onClose={() => setModal(null)}
          onSent={() => {
            setModal(null);
            void loadConversations();
          }}
        />
      ) : null}
      {modal === "bulkEmail" ? (
        <BulkEmailModal recipients={recipients} onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function SingleModal({
  recipients,
  onClose,
  onSent,
}: {
  recipients: Recipient[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withPhone = recipients.filter((r) => r.hasPhone);

  async function send() {
    if (busy) return;
    if (!message.trim()) {
      setError("Enter a message.");
      return;
    }
    if (!staffId && !number.trim()) {
      setError("Pick a staff member or enter a number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          staffId ? { staffId, message } : { to: number, message },
        ),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Could not send.");
        return;
      }
      onSent();
    } catch {
      setError("Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New Message" onClose={onClose}>
      <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">To</label>
      <select
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
        className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      >
        <option value="">Select staff or enter number…</option>
        {withPhone.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} — {r.phone}
          </option>
        ))}
      </select>
      {!staffId ? (
        <input
          type="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="(555) 555-5555"
          className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
      ) : null}
      <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Message</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Type your message..."
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      />
      <p className="mt-1 text-[11px] text-[var(--muted)]">{segInfo(message)}</p>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {busy ? "Sending…" : "Send"}
      </button>
    </ModalShell>
  );
}

function RecipientPicker({
  people,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  emptyLabel,
}: {
  people: Recipient[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  emptyLabel: string;
}) {
  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Recipients ({selectedIds.size})
        </span>
        <span className="flex gap-3 text-xs">
          <button type="button" onClick={onSelectAll} className="text-[var(--brand)] hover:underline">
            Select all
          </button>
          <button type="button" onClick={onClear} className="text-[var(--muted)] hover:underline">
            Clear
          </button>
        </span>
      </div>
      <div className="mb-3 max-h-40 overflow-auto rounded-lg border border-[var(--border)]">
        {people.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[var(--muted)]">{emptyLabel}</p>
        ) : (
          people.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)]"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(r.id)}
                onChange={() => onToggle(r.id)}
              />
              <span className="text-[var(--foreground)]">{r.name}</span>
            </label>
          ))
        )}
      </div>
    </>
  );
}

function DeptFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
        Filter by category
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      >
        <option value="">All staff</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </>
  );
}

function BulkSmsModal({
  recipients,
  onClose,
  onSent,
}: {
  recipients: Recipient[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [dept, setDept] = useState("");
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const people = useMemo(
    () =>
      recipients.filter(
        (r) => r.hasPhone && (!dept || r.departments.includes(dept)),
      ),
    [recipients, dept],
  );

  function toggle(id: string) {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (busy || ids.size === 0 || !message.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/sms/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ staffIds: Array.from(ids), message }),
      });
      const d = await r.json();
      if (!r.ok) {
        setNote(d.error || "Could not send.");
        return;
      }
      onSent();
    } catch {
      setNote("Could not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Send Bulk SMS" onClose={onClose}>
      <DeptFilter value={dept} onChange={(v) => { setDept(v); setIds(new Set()); }} />
      <RecipientPicker
        people={people}
        selectedIds={ids}
        onToggle={toggle}
        onSelectAll={() => setIds(new Set(people.map((p) => p.id)))}
        onClear={() => setIds(new Set())}
        emptyLabel="No staff with phone numbers in this category."
      />
      <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Message</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Type your message..."
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      />
      <p className="mt-1 text-[11px] text-[var(--muted)]">{segInfo(message)}</p>
      {note ? <p className="mt-1 text-xs text-red-600">{note}</p> : null}
      <button
        type="button"
        onClick={send}
        disabled={busy || ids.size === 0}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {busy ? "Sending…" : `Send to ${ids.size} recipient${ids.size === 1 ? "" : "s"}`}
      </button>
    </ModalShell>
  );
}

function BulkEmailModal({
  recipients,
  onClose,
}: {
  recipients: Recipient[];
  onClose: () => void;
}) {
  const [dept, setDept] = useState("");
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const people = useMemo(
    () =>
      recipients.filter(
        (r) => r.hasEmail && (!dept || r.departments.includes(dept)),
      ),
    [recipients, dept],
  );

  function toggle(id: string) {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEmail() {
    const emails = people
      .filter((p) => ids.has(p.id) && p.email)
      .map((p) => p.email as string);
    if (emails.length === 0) return;
    const url = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    window.location.href = url;
    onClose();
  }

  return (
    <ModalShell title="Send Bulk Email" onClose={onClose}>
      <DeptFilter value={dept} onChange={(v) => { setDept(v); setIds(new Set()); }} />
      <RecipientPicker
        people={people}
        selectedIds={ids}
        onToggle={toggle}
        onSelectAll={() => setIds(new Set(people.map((p) => p.id)))}
        onClear={() => setIds(new Set())}
        emptyLabel="No staff with email addresses in this category."
      />
      <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Subject</label>
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Email subject..."
        className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      />
      <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Message</label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Type your message..."
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={openEmail}
        disabled={ids.size === 0}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        <Mail className="h-4 w-4" />
        Open Email with {ids.size} recipient{ids.size === 1 ? "" : "s"}
      </button>
    </ModalShell>
  );
}
