import { SupportGuideClient } from "@/components/support-guide/support-guide-client";
import { isGuestRole } from "@/lib/auth/guest";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getSupportGuideArticles } from "@/lib/support-guide/topics";

const GUEST_SUPPORT_SLUGS = new Set([
  "hub-overview",
  "guest-access",
  "roles-and-access",
  "home",
  "resources",
  "training-portal",
  "support-guide",
]);


type SupportGuidePageProps = {
  searchParams: Promise<{ topic?: string; slug?: string }>;
};

export default async function SupportGuidePage({
  searchParams,
}: SupportGuidePageProps) {
  const params = await searchParams;
  const topic = (params.topic ?? params.slug ?? "").trim() || null;
  const profile = await getCurrentProfile();
  const guest = isGuestRole(profile?.role);
  const articles = getSupportGuideArticles().filter((article) => {
    if (guest && !GUEST_SUPPORT_SLUGS.has(article.slug)) return false;
    return true;
  });
  const initialTopic =
    topic && articles.some((article) => article.slug === topic) ? topic : null;

  return (
    <SupportGuideClient articles={articles} initialTopic={initialTopic} />
  );
}
