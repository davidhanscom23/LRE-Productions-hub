import { AskPageClient } from "@/components/ask/ask-page-client";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/kb";
import type { KbArticle } from "@/lib/types/kb";

export const metadata = {
  title: "Ask the Hub",
};

export default async function AskPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const supabase = await createClient();

  const [{ data: articles }, { data: hubGuides }, { count }] = await Promise.all([
    supabase
      .from("kb_documents")
      .select("id,title,content,created_at")
      .eq("source_type", "article")
      .order("created_at", { ascending: false }),
    supabase
      .from("kb_documents")
      .select("id,title,content,created_at")
      .eq("source_type", "hub_guide")
      .order("title", { ascending: true }),
    supabase.from("kb_chunks").select("id", { count: "exact", head: true }),
  ]);

  return (
    <AskPageClient
      isAdmin={isAdmin}
      configured={isAiConfigured()}
      articles={(articles ?? []) as KbArticle[]}
      hubGuides={(hubGuides ?? []) as KbArticle[]}
      indexedChunks={count ?? 0}
    />
  );
}
