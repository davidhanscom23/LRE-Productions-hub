// Server-side "Ask the Hub" knowledge-base helpers (embeddings + chunking).
// Uses OpenAI via the Vercel AI SDK. The OPENAI_API_KEY lives ONLY in server
// env vars — never import this into a client component.

import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

export const EMBED_MODEL = "text-embedding-3-small"; // 1536 dimensions
export const CHAT_MODEL = "gpt-4o-mini";
export const MATCH_COUNT = 6;
export const SIMILARITY_THRESHOLD = 0.3;

/** True once the OpenAI key is present. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Split text into ~1500-character chunks with light overlap for context. */
export function chunkText(text: string, size = 1500, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks.filter(Boolean);
}

/** Embed a single string (e.g. a user's question). */
export async function embedText(value: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBED_MODEL),
    value,
  });
  return embedding;
}

/** Embed many strings in one batched call (for indexing). */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await embedMany({
    model: openai.embedding(EMBED_MODEL),
    values,
  });
  return embeddings;
}
