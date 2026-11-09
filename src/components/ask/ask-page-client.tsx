"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Eraser,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  addArticle,
  deleteArticle,
  rebuildIndex,
  syncDriveIndex,
  updateArticle,
  uploadKnowledgeDocument,
} from "@/app/(app)/ask/actions";
import { ASK_EXAMPLE_QUESTION_GROUPS } from "@/lib/kb/example-questions";
import { KB_UPLOAD_ACCEPT } from "@/lib/kb/upload-constants";
import { supportGuideHrefForSourceTitle } from "@/lib/support-guide/source-links";
import type { KbArticle } from "@/lib/types/kb";

type Msg = { role: "user" | "assistant"; text: string; sources?: string[] };

export function AskPageClient({
  isAdmin,
  configured,
  articles,
  hubGuides,
  indexedChunks,
}: {
  isAdmin: boolean;
  configured: boolean;
  articles: KbArticle[];
  hubGuides: KbArticle[];
  indexedChunks: number;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState<boolean | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);

  async function askQuestion(raw: string) {
    const q = raw.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (data.error === "not_configured") {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "The assistant isn’t connected yet — an admin needs to add the OpenAI key.",
          },
        ]);
      } else if (data.error) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "Sorry, something went wrong answering that. Try again in a moment.",
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.answer, sources: data.sources },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Network error — please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    await askQuestion(input);
  }

  function clearConversation() {
    if (loading) return;
    setMessages([]);
    setInput("");
  }

  function doRebuild() {
    setRebuildMsg(null);
    startTransition(async () => {
      const r = await rebuildIndex();
      setRebuildMsg(r.message);
    });
  }

  function doSyncDrive() {
    setRebuildMsg(null);
    startTransition(async () => {
      const r = await syncDriveIndex();
      setRebuildMsg(r.message);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
            Ask the Hub
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Ask a question and get an answer from our own company documents.
          </p>
        </div>
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          The assistant isn’t connected yet. An admin needs to add{" "}
          <code>OPENAI_API_KEY</code> (in <code>.env.local</code> and Vercel),
          then rebuild the knowledge index.
        </div>
      )}

      {/* Conversation */}
      <section className="space-y-4" aria-label="Ask a question">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Ask a question
          </h2>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={clearConversation}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear conversation
            </button>
          ) : null}
        </div>

        {messages.length === 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            Type a question below, or tap an example from the reference list
            when you’re stuck. Clear the conversation after you’ve reviewed
            answers to start fresh.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={[
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
              ].join(" ")}
            >
              <p className="whitespace-pre-line">{m.text}</p>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 border-t border-[var(--border)] pt-2">
                  <p className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                    Sources
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.sources.map((source) => {
                      const href = supportGuideHrefForSourceTitle(source);
                      return (
                        <li key={source}>
                          {href ? (
                            <Link
                              href={href}
                              className="inline-flex max-w-full items-center rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-xs font-medium text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                            >
                              <span className="truncate">{source}</span>
                            </Link>
                          ) : (
                            <span className="inline-flex max-w-full items-center rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--muted)]">
                              <span className="truncate">{source}</span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
      </section>

      {/* Ask box */}
      <form onSubmit={ask} className="sticky bottom-4 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-white disabled:opacity-50"
          aria-label="Ask"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Example questions reference — closed on load; hover draws attention */}
      <section
        className="group/examples overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-[border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--brand)]/45 hover:shadow-[0_10px_28px_-18px_color-mix(in_oklab,var(--brand)_55%,transparent)]"
        aria-label="Example questions"
      >
        <button
          type="button"
          onClick={() => setExamplesOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-300 group-hover/examples:bg-[var(--brand-soft)]/40"
          aria-expanded={examplesOpen}
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--foreground)] transition-colors duration-300 group-hover/examples:text-[var(--brand)]">
              Example questions
            </h2>
            <p className="text-xs text-[var(--muted)] transition-colors duration-300 group-hover/examples:text-[var(--foreground)]/70">
              Stuck? Open this for ready-made Hub feature prompts.
            </p>
          </div>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--muted)] transition-all duration-300 group-hover/examples:border-[var(--brand)]/30 group-hover/examples:bg-[var(--surface)] group-hover/examples:text-[var(--brand)]">
            <ChevronDown
              className={[
                "h-4 w-4 transition-transform duration-300 ease-out",
                examplesOpen ? "rotate-180" : "group-hover/examples:translate-y-0.5",
              ].join(" ")}
            />
          </span>
        </button>
        <div
          className={[
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            examplesOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          ].join(" ")}
        >
          <div className="overflow-hidden">
            <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">
              {ASK_EXAMPLE_QUESTION_GROUPS.map((group) => (
                <div key={group.label} className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
                    {group.label}
                  </p>
                  <ul className="space-y-1.5">
                    {group.questions.map((question) => (
                      <li key={question}>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            void askQuestion(question);
                          }}
                          className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-[var(--foreground)] transition-all duration-200 hover:translate-x-0.5 hover:bg-[var(--brand-soft)]/55 hover:text-[var(--brand)] disabled:opacity-50"
                        >
                          {question}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Admin: knowledge management */}
      {isAdmin && (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                Manage knowledge{" "}
                <span className="font-normal text-[var(--muted)]">(admin)</span>
              </h2>
              <p className="text-xs text-[var(--muted)]">
                {indexedChunks} searchable chunks indexed. Rebuild syncs Hub
                feature guides, Resources, and vendors. Sync Drive indexes Docs,
                Sheets, PDF, and Word files from the company Drive folder.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={doSyncDrive}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--brand)] disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-[var(--brand)]" />
                )}
                Sync Drive
              </button>
              <button
                type="button"
                onClick={doRebuild}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--brand)] disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-[var(--brand)]" />
                )}
                Rebuild index
              </button>
            </div>
          </div>
          {rebuildMsg && (
            <p className="text-xs text-[var(--muted)]">{rebuildMsg}</p>
          )}

          <form
            ref={formRef}
            action={async (fd) => {
              await addArticle(fd);
              formRef.current?.reset();
            }}
            className="space-y-2 border-t border-[var(--border)] pt-4"
          >
            <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
              Articles &amp; answers
            </p>
            <input
              name="title"
              required
              placeholder="Article title (e.g. Overtime policy)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Write the answer / policy / how-to here…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add article
            </button>
          </form>

          <form
            ref={uploadFormRef}
            action={async (fd) => {
              setUploadMsg(null);
              setUploadOk(null);
              const result = await uploadKnowledgeDocument(fd);
              setUploadOk(result.ok);
              setUploadMsg(result.message);
              if (result.ok) uploadFormRef.current?.reset();
            }}
            className="space-y-2 border-t border-[var(--border)] pt-4"
          >
            <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
              Upload PDF or Word
            </p>
            <p className="text-xs text-[var(--muted)]">
              Extracts text into the knowledge base (PDF or .docx, up to 10 MB).
              Uploads appear in the list below so you can edit or delete them
              anytime. Scanned image-only PDFs and old .doc files won’t work.
            </p>
            <input
              name="title"
              placeholder="Optional title (defaults to file name)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            />
            <input
              name="file"
              type="file"
              required
              accept={KB_UPLOAD_ACCEPT}
              className="block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand-soft)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--brand)]"
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--brand)] disabled:opacity-50"
            >
              <FileUp className="h-4 w-4 text-[var(--brand)]" />
              Upload &amp; index
            </button>
            {uploadMsg ? (
              <p
                className={[
                  "text-xs",
                  uploadOk
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-amber-800 dark:text-amber-200",
                ].join(" ")}
              >
                {uploadMsg}
              </p>
            ) : null}
          </form>

          {articles.length > 0 && (
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
                Saved articles
              </p>
              <p className="text-xs text-[var(--muted)]">
                Typed articles and uploaded PDF/Word docs. Edit the extracted
                text or delete anything you no longer want indexed.
              </p>
              <ul className="divide-y divide-[var(--border)]">
              {articles.map((a) => {
                const uploadedFrom = a.content.includes("Imported from PDF")
                  ? "PDF"
                  : a.content.includes("Imported from Word")
                    ? "Word"
                    : null;
                return (
                <li key={a.id} className="py-2.5">
                  {editingId === a.id ? (
                    <form
                      action={async (fd) => {
                        await updateArticle(fd);
                        setEditingId(null);
                      }}
                      className="space-y-2"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <input
                        name="title"
                        required
                        defaultValue={a.title}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                      />
                      <textarea
                        name="body"
                        required
                        rows={uploadedFrom ? 10 : 4}
                        defaultValue={a.content}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white"
                        >
                          Save changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">
                            {a.title}
                          </p>
                          {uploadedFrom ? (
                            <span className="rounded-md bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--brand)] uppercase">
                              From {uploadedFrom}
                            </span>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 text-xs text-[var(--muted)]">
                          {a.content}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(a.id)}
                          aria-label={`Edit ${a.title}`}
                          className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(async () => {
                              await deleteArticle(a.id);
                            })
                          }
                          aria-label={`Delete ${a.title}`}
                          className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
                );
              })}
              </ul>
            </div>
          )}

          {hubGuides.length > 0 && (
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
                Hub feature guides (auto-synced)
              </p>
              <p className="text-xs text-[var(--muted)]">
                Maintained in code and refreshed on Rebuild index. Edit the
                registry to change these — not the list below.
              </p>
              <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                {hubGuides.map((guide) => (
                  <li key={guide.id} className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {guide.title}
                    </p>
                    <p className="line-clamp-2 text-xs text-[var(--muted)]">
                      {guide.content}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
