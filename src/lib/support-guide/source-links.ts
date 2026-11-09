import { HUB_FEATURE_ARTICLES } from "@/lib/kb/hub-feature-articles";
import { SUPPORT_GUIDE_TOPICS } from "@/lib/support-guide/topics";

const guideSlugs = new Set(SUPPORT_GUIDE_TOPICS.map((topic) => topic.slug));

/**
 * Map an Ask source title (kb_documents.title) to a Support Guide deep link
 * when that article is indexed in SUPPORT_GUIDE_TOPICS.
 */
export function supportGuideHrefForSourceTitle(
  title: string,
): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const article =
    HUB_FEATURE_ARTICLES.find((row) => row.title === trimmed) ??
    HUB_FEATURE_ARTICLES.find(
      (row) => row.title.toLowerCase() === trimmed.toLowerCase(),
    ) ??
    HUB_FEATURE_ARTICLES.find((row) => row.slug === trimmed);

  if (!article || !guideSlugs.has(article.slug)) return null;
  return `/support-guide?topic=${encodeURIComponent(article.slug)}`;
}
