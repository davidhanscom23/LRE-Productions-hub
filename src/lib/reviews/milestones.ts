/** Sliding-scale Hub points for attributed website client reviews. */

export type ClientReviewMilestone = {
  key: string;
  count: number;
  title: string;
  points: number;
};

export const CLIENT_REVIEW_MILESTONES: ClientReviewMilestone[] = [
  {
    key: "client_reviews_1",
    count: 1,
    title: "First client review",
    points: 40,
  },
  {
    key: "client_reviews_3",
    count: 3,
    title: "Client reviews · 3",
    points: 60,
  },
  {
    key: "client_reviews_5",
    count: 5,
    title: "Client reviews · 5",
    points: 100,
  },
  {
    key: "client_reviews_10",
    count: 10,
    title: "Client reviews · 10",
    points: 200,
  },
  {
    key: "client_reviews_25",
    count: 25,
    title: "Client reviews · 25",
    points: 400,
  },
  {
    key: "client_reviews_50",
    count: 50,
    title: "Client reviews · 50",
    points: 750,
  },
  {
    key: "client_reviews_100",
    count: 100,
    title: "Client reviews · 100",
    points: 1500,
  },
];

export function nextClientReviewMilestone(
  count: number,
): ClientReviewMilestone | null {
  return CLIENT_REVIEW_MILESTONES.find((m) => count < m.count) ?? null;
}

export function earnedClientReviewMilestones(
  count: number,
): ClientReviewMilestone[] {
  return CLIENT_REVIEW_MILESTONES.filter((m) => count >= m.count);
}
