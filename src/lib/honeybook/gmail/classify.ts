import "server-only";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  buildPrompt,
  parseClassification,
  SYSTEM,
  type Classification,
  type ProjectContext,
} from "@/lib/honeybook/gmail/classify-core";
import type { ParsedMessage } from "@/lib/honeybook/gmail/parse";
import { CHAT_MODEL, isAiConfigured } from "@/lib/kb";

export type { Classification, ProjectContext };

export async function classifyMessage(args: {
  message: ParsedMessage;
  staffName: string;
  project: ProjectContext | null;
  notLeadExamples?: string[];
}): Promise<{ result: Classification | null; error: string | null }> {
  if (!isAiConfigured()) {
    return { result: null, error: "OPENAI_API_KEY is not configured." };
  }
  try {
    const res = await generateText({
      model: openai(CHAT_MODEL),
      system: SYSTEM,
      prompt: buildPrompt(args),
      temperature: 0.1,
    });
    const parsed = parseClassification(res.text);
    if (!parsed) return { result: null, error: "Model returned unusable JSON." };
    return { result: parsed, error: null };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Classification failed.",
    };
  }
}
