import { NextResponse, type NextRequest } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  CHAT_MODEL,
  MATCH_COUNT,
  SIMILARITY_THRESHOLD,
  embedText,
  isAiConfigured,
} from "@/lib/kb";

type MatchRow = { content: string; title: string };

export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "not_configured" });
  }

  let question = "";
  try {
    const body = await request.json();
    question = String(body.question ?? "").trim();
  } catch {
    // ignore — handled below
  }
  if (!question) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  let embedding: number[];
  try {
    embedding = await embedText(question);
  } catch {
    return NextResponse.json({ error: "embed_failed" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("match_kb_chunks", {
    query_embedding: embedding,
    match_count: MATCH_COUNT,
    similarity_threshold: SIMILARITY_THRESHOLD,
  });
  if (error) {
    return NextResponse.json({ error: error.message });
  }

  const chunks = (data ?? []) as MatchRow[];
  if (chunks.length === 0) {
    try {
      const { awardAchievement } = await import("@/lib/points/hub-points");
      await awardAchievement(supabase, "ask_hub_question", {
        question_len: question.length,
        no_sources: true,
      });
    } catch {
      // non-critical
    }
    return NextResponse.json({
      answer:
        "I don’t have anything documented about that yet. Try rewording it, or ask a manager — and consider adding it to the knowledge base.",
      sources: [],
    });
  }

  const context = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.title}]\n${c.content}`)
    .join("\n\n---\n\n");

  const system =
    "You are the Vident Productions staff assistant. Answer ONLY using the provided context, which comes from the company's internal documents. If the context does not contain the answer, say you don't have that documented and suggest asking a manager. Never invent company policy, prices, or procedures. Be concise, friendly, and practical.";

  let answer = "";
  try {
    const res = await generateText({
      model: openai(CHAT_MODEL),
      system,
      prompt: `Question: ${question}\n\nContext:\n${context}`,
      temperature: 0.2,
    });
    answer = res.text;
  } catch {
    return NextResponse.json({ error: "generate_failed" });
  }

  const sources = Array.from(new Set(chunks.map((c) => c.title))).filter(
    Boolean,
  );

  try {
    const { awardAchievement } = await import("@/lib/points/hub-points");
    await awardAchievement(supabase, "ask_hub_question", {
      question_len: question.length,
    });
  } catch {
    // non-critical
  }

  return NextResponse.json({ answer, sources });
}
