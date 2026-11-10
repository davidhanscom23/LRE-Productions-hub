import { HUB_FEATURE_ARTICLES } from "@/lib/kb/hub-feature-articles";

export type SupportGuideCategory =
  | "Getting started"
  | "Day to day"
  | "Field tools"
  | "People & teams"
  | "Access";

export type SupportGuideTopic = {
  slug: string;
  category: SupportGuideCategory;
  /** Optional deep link into the related Hub module. */
  moduleHref?: string;
  moduleLabel?: string;
};

/**
 * Curated Support Guide index. Bodies come from HUB_FEATURE_ARTICLES
 * so Ask the Hub and this page stay in sync.
 */
export const SUPPORT_GUIDE_TOPICS: SupportGuideTopic[] = [
  {
    slug: "hub-overview",
    category: "Getting started",
    moduleHref: "/",
    moduleLabel: "Open Home",
  },
  {
    slug: "roles-and-access",
    category: "Access",
  },
  {
    slug: "guest-access",
    category: "Access",
    moduleHref: "/guest",
    moduleLabel: "Guest access",
  },
  {
    slug: "home",
    category: "Getting started",
    moduleHref: "/",
    moduleLabel: "Open Home",
  },
  {
    slug: "for-you",
    category: "Day to day",
    moduleHref: "/for-you",
    moduleLabel: "Open For You",
  },
  {
    slug: "ask-the-hub",
    category: "Getting started",
    moduleHref: "/ask",
    moduleLabel: "Ask the Hub",
  },
  {
    slug: "my-week",
    category: "Day to day",
    moduleHref: "/my-week",
    moduleLabel: "Open My Week",
  },
  {
    slug: "calendar",
    category: "Day to day",
    moduleHref: "/calendar",
    moduleLabel: "Open Calendar",
  },
  {
    slug: "time-off",
    category: "Day to day",
    moduleHref: "/time-off",
    moduleLabel: "Open Time Off",
  },
  {
    slug: "action-center",
    category: "Day to day",
    moduleHref: "/action-center",
    moduleLabel: "Open Action Center",
  },
  {
    slug: "reviews",
    category: "People & teams",
    moduleHref: "/reviews",
    moduleLabel: "Open Reviews",
  },
  {
    slug: "directory",
    category: "People & teams",
    moduleHref: "/directory",
    moduleLabel: "Open Directory",
  },
  {
    slug: "expenses",
    category: "Day to day",
    moduleHref: "/expenses",
    moduleLabel: "Open Expenses",
  },
  {
    slug: "contractor-pay",
    category: "Day to day",
    moduleHref: "/contractor-pay",
    moduleLabel: "Open Contractor Pay",
  },
  {
    slug: "quoting",
    category: "Day to day",
    moduleHref: "/quoting",
    moduleLabel: "Open Quoting",
  },
  {
    slug: "venue-quotes",
    category: "Day to day",
    moduleHref: "/venue-quotes",
    moduleLabel: "Open Venue Quotes",
  },
  {
    slug: "proposals",
    category: "Day to day",
    moduleHref: "/proposals",
    moduleLabel: "Open Proposals",
  },
  {
    slug: "announcements",
    category: "Day to day",
    moduleHref: "/announcements",
    moduleLabel: "Open Announcements",
  },
  {
    slug: "kudos",
    category: "People & teams",
    moduleHref: "/kudos",
    moduleLabel: "Open Kudos",
  },
  {
    slug: "winners",
    category: "Day to day",
    moduleHref: "/winners",
    moduleLabel: "Open Winners",
  },
  {
    slug: "my-calendar",
    category: "Day to day",
    moduleHref: "/my-calendar",
    moduleLabel: "Open My Calendar",
  },
  {
    slug: "forum",
    category: "Day to day",
    moduleHref: "/forum",
    moduleLabel: "Open Forum",
  },
  {
    slug: "meetings",
    category: "People & teams",
    moduleHref: "/meetings",
    moduleLabel: "Open Meetings",
  },
  {
    slug: "pebbles-and-rocks",
    category: "Day to day",
    moduleHref: "/pebbles-and-rocks",
    moduleLabel: "Open Pebbles and Rocks",
  },
  {
    slug: "marketing-library",
    category: "Day to day",
    moduleHref: "/marketing-library",
    moduleLabel: "Open Marketing Library",
  },
  {
    slug: "video-archives",
    category: "Day to day",
    moduleHref: "/videos",
    moduleLabel: "Open Video Archives",
  },
  {
    slug: "sms-portal",
    category: "Access",
    moduleHref: "/sms",
    moduleLabel: "Open SMS Portal",
  },
  {
    slug: "communications",
    category: "Access",
    moduleHref: "/communications",
    moduleLabel: "Open Communications",
  },
  {
    slug: "onboarding",
    category: "People & teams",
    moduleHref: "/onboarding",
    moduleLabel: "Open Onboarding",
  },
  {
    slug: "hiring",
    category: "People & teams",
    moduleHref: "/hiring",
    moduleLabel: "Open Hiring",
  },
  {
    slug: "staffing",
    category: "People & teams",
    moduleHref: "/staffing",
    moduleLabel: "Open Staffing",
  },
  {
    slug: "reports",
    category: "People & teams",
    moduleHref: "/reports",
    moduleLabel: "Open Reports",
  },
  {
    slug: "hub-health",
    category: "Access",
    moduleHref: "/hub-health",
    moduleLabel: "Open Hub health",
  },
  {
    slug: "polls",
    category: "Day to day",
    moduleHref: "/polls",
    moduleLabel: "Open Polls",
  },
  {
    slug: "notification-preferences",
    category: "Getting started",
    moduleHref: "/notification-settings",
    moduleLabel: "Notification preferences",
  },
  {
    slug: "chat",
    category: "Day to day",
    moduleHref: "/chat",
    moduleLabel: "Open Chat",
  },
  {
    slug: "event-packets",
    category: "Field tools",
    moduleHref: "/event-packets",
    moduleLabel: "Event Packets",
  },
  {
    slug: "social-studio",
    category: "Field tools",
    moduleHref: "/social-studio",
    moduleLabel: "Social Studio",
  },
  {
    slug: "image-studio",
    category: "Field tools",
    moduleHref: "/image-studio",
    moduleLabel: "Image Studio",
  },
  {
    slug: "marketing-queue",
    category: "Field tools",
    moduleHref: "/marketing",
    moduleLabel: "Marketing Queue",
  },
  {
    slug: "content-sla",
    category: "Field tools",
    moduleHref: "/content-sla",
    moduleLabel: "Content SLA",
  },
  {
    slug: "end-of-event-report",
    category: "Field tools",
    moduleHref: "/end-of-event-report",
    moduleLabel: "End of Event Report",
  },
  {
    slug: "submit-event-photos",
    category: "Field tools",
    moduleHref: "/submit-event-photos",
    moduleLabel: "Submit Event Photos",
  },
  {
    slug: "people",
    category: "People & teams",
    moduleHref: "/people",
    moduleLabel: "Open People",
  },
  {
    slug: "teams",
    category: "People & teams",
    moduleHref: "/teams",
    moduleLabel: "Open Teams",
  },
  {
    slug: "vident-av",
    category: "People & teams",
    moduleHref: "/rentals",
    moduleLabel: "Open LRE AV",
  },
  {
    slug: "resources",
    category: "Getting started",
    moduleHref: "/resources",
    moduleLabel: "Open Resources",
  },
  {
    slug: "vendors",
    category: "Field tools",
    moduleHref: "/vendors",
    moduleLabel: "Open Vendors",
  },
  {
    slug: "staff-handbook",
    category: "Getting started",
    moduleHref: "/documents",
    moduleLabel: "Documents",
  },
  {
    slug: "training-portal",
    category: "People & teams",
    moduleHref: "/training-portal",
    moduleLabel: "Training Portal",
  },
];

export type SupportGuideArticleView = {
  slug: string;
  category: SupportGuideCategory;
  title: string;
  body: string;
  moduleHref?: string;
  moduleLabel?: string;
};

export function getSupportGuideArticles(): SupportGuideArticleView[] {
  const bySlug = new Map(
    HUB_FEATURE_ARTICLES.map((article) => [article.slug, article]),
  );

  return SUPPORT_GUIDE_TOPICS.flatMap((topic) => {
    const article = bySlug.get(topic.slug);
    if (!article) return [];
    return [
      {
        slug: topic.slug,
        category: topic.category,
        title: article.title,
        body: article.body,
        moduleHref: topic.moduleHref,
        moduleLabel: topic.moduleLabel,
      },
    ];
  });
}

export const SUPPORT_GUIDE_CATEGORIES: SupportGuideCategory[] = [
  "Getting started",
  "Day to day",
  "Field tools",
  "People & teams",
  "Access",
];
