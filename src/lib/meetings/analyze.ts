// Server-side meeting transcript analysis using the hub's OpenAI model
// (gpt-4o-mini via the Vercel AI SDK). Server-only — never import client-side.

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { CHAT_MODEL, isAiConfigured } from "@/lib/kb";

export type AnalyzedActionItem = {
  text: string;
  owner: string;
  due_date: string | null;
};

export type MeetingAnalysis = {
  summary: string;
  quality_score: number;
  strengths: string[];
  improvements: string[];
  action_items: AnalyzedActionItem[];
};

const SYSTEM = [
  "You are a meeting-effectiveness analyst for an event-production company (audiovisual, corporate, weddings & social, golf).",
  "You read a meeting transcript or notes and return a concise, useful analysis.",
  "Score meeting quality 0-100 based on: clear decisions, clear owners for next steps,",
  "focus/time use, and follow-through clarity. Extract concrete action items with an owner",
  "and (if stated or clearly implied) a due date in YYYY-MM-DD form.",
  "Never invent facts that are not supported by the transcript. If owners or dates are not",
  "stated, use an empty string for owner and null for due_date.",
  "Return ONLY valid minified JSON, no markdown fences.",
].join(" ");

function clampScore(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function cleanDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^\d{4}-\d{2}-\d{2}$/);
  return m ? v.trim() : null;
}

/** Analyze a transcript. Returns null with an error string if unavailable. */
export async function analyzeMeeting(
  transcript: string,
  meta: { title?: string; date?: string | null },
): Promise<{ analysis: MeetingAnalysis | null; error: string | null }> {
  if (!isAiConfigured()) {
    return {
      analysis: null,
      error: "AI isn’t configured yet — add OPENAI_API_KEY, then re-analyze.",
    };
  }
  const text = transcript.trim();
  if (text.length < 40) {
    return { analysis: null, error: "Add a longer transcript to analyze." };
  }

  // Keep the prompt within a sane size.
  const clipped = text.slice(0, 24000);
  const prompt = [
    meta.title ? `Meeting title: ${meta.title}` : "",
    meta.date ? `Meeting date: ${meta.date}` : "",
    "",
    "Transcript / notes:",
    clipped,
    "",
    "Return JSON shaped exactly like:",
    '{"summary":"2-4 sentence summary","quality_score":0,"strengths":["..."],"improvements":["..."],"action_items":[{"text":"...","owner":"","due_date":null}]}',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await generateText({
      model: openai(CHAT_MODEL),
      system: SYSTEM,
      prompt,
      temperature: 0.2,
    });

    const raw = res.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const analysis: MeetingAnalysis = {
      summary: String(parsed.summary ?? "").trim(),
      quality_score: clampScore(parsed.quality_score),
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.map((s) => String(s)).filter(Boolean).slice(0, 8)
        : [],
      improvements: Array.isArray(parsed.improvements)
        ? parsed.improvements.map((s) => String(s)).filter(Boolean).slice(0, 8)
        : [],
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items
            .map((a) => {
              const item = a as Record<string, unknown>;
              return {
                text: String(item.text ?? "").trim(),
                owner: String(item.owner ?? "").trim(),
                due_date: cleanDate(item.due_date),
              };
            })
            .filter((a) => a.text)
            .slice(0, 30)
        : [],
    };

    return { analysis, error: null };
  } catch (error) {
    return {
      analysis: null,
      error:
        error instanceof Error
          ? `Analysis failed: ${error.message}`
          : "Analysis failed.",
    };
  }
}
