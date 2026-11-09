"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPostAction } from "@/app/(app)/actions";

export function NewPostBox() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const value = body.trim();
    if (!value) {
      setError("Write something before posting.");
      return;
    }

    startTransition(async () => {
      const result = await createPostAction(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <label htmlFor="feed-post" className="sr-only">
        New post
      </label>
      <textarea
        id="feed-post"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Share an announcement with the team…"
        className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-soft)]"
      />
      {error && (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
