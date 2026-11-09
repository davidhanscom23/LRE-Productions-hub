"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, LifeBuoy, Search } from "lucide-react";
import type { SupportGuideArticleView } from "@/lib/support-guide/topics";
import { SUPPORT_GUIDE_CATEGORIES } from "@/lib/support-guide/topics";

type SupportGuideClientProps = {
  articles: SupportGuideArticleView[];
  initialTopic?: string | null;
};

function bodyParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function SupportGuideClient({
  articles,
  initialTopic = null,
}: SupportGuideClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [activeSlug, setActiveSlug] = useState<string | null>(initialTopic);
  const [topicBaseline, setTopicBaseline] = useState(initialTopic);

  if (initialTopic !== topicBaseline) {
    setTopicBaseline(initialTopic);
    setActiveSlug(initialTopic);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category !== "all" && article.category !== category) return false;
      if (!q) return true;
      const haystack = [article.title, article.body, article.category]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [articles, category, query]);

  const active =
    articles.find((article) => article.slug === activeSlug) ?? null;

  function openTopic(slug: string) {
    setActiveSlug(slug);
    router.replace(`/support-guide?topic=${encodeURIComponent(slug)}`, {
      scroll: false,
    });
  }

  function backToTopics() {
    setActiveSlug(null);
    router.replace("/support-guide", { scroll: false });
  }

  if (active) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={backToTopics}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to topics
        </button>

        <article className="space-y-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--brand)] uppercase">
            {active.category}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {active.title}
          </h1>
          <div className="space-y-3 text-sm leading-relaxed text-[var(--foreground)]">
            {bodyParagraphs(active.body).map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-[var(--foreground)]">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {active.moduleHref ? (
              <Link
                href={active.moduleHref}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {active.moduleLabel ?? "Open module"}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            <Link
              href="/ask"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-[var(--surface-hover)]"
            >
              Ask the Hub
            </Link>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-[var(--brand)]" />
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Support Guide
          </h1>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          How-to playbooks for Hub modules. For free-form questions, use{" "}
          <Link href="/ask" className="font-medium text-[var(--brand)] hover:underline">
            Ask the Hub
          </Link>
          ; for files and links, use{" "}
          <Link
            href="/resources"
            className="font-medium text-[var(--brand)] hover:underline"
          >
            Resources
          </Link>
          . Topic links use{" "}
          <span className="font-mono text-[11px]">?topic=</span>.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics…"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          />
        </label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
        >
          <option value="all">All categories</option>
          {SUPPORT_GUIDE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/ask"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-hover)]"
        >
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Ask the Hub
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Get answers from indexed company knowledge.
          </p>
        </Link>
        <Link
          href="/resources"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-hover)]"
        >
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Resources
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Files, forms, and shared links by category.
          </p>
        </Link>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No topics match that search.
        </p>
      ) : (
        <div className="space-y-6">
          {SUPPORT_GUIDE_CATEGORIES.map((cat) => {
            const items = filtered.filter((article) => article.category === cat);
            if (!items.length) return null;
            return (
              <section key={cat} className="space-y-2">
                <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
                  {cat}
                </h2>
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  {items.map((article) => (
                    <button
                      key={article.slug}
                      type="button"
                      onClick={() => openTopic(article.slug)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--surface-hover)]"
                    >
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                      <span>
                        <span className="block text-sm font-medium text-[var(--foreground)]">
                          {article.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted)] line-clamp-2">
                          {article.body.split("\n").find((line) => line.trim())}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
