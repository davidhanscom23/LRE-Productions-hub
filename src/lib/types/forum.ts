export type ForumCategory = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

export type ForumAttachment = {
  id: string;
  thread_id: string;
  title: string;
  url: string;
  created_by: string | null;
  created_at: string;
};

export type ForumThreadListItem = {
  id: string;
  category_id: string | null;
  category_name: string | null;
  author_id: string;
  author_name: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  last_activity_at: string;
  reply_count: number;
  attachment_count: number;
  is_following: boolean;
};

export type ForumThreadDetail = {
  id: string;
  category_id: string | null;
  category_name: string | null;
  author_id: string;
  author_name: string;
  author_color: string | null;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  is_following: boolean;
  attachments: ForumAttachment[];
};

export type ForumPost = {
  id: string;
  thread_id: string;
  author_id: string;
  author_name: string;
  author_color: string | null;
  body: string;
  created_at: string;
};

export type ForumSort = "active" | "newest" | "unanswered" | "following" | "mine";

export const FORUM_SORTS: { id: ForumSort; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "newest", label: "Newest" },
  { id: "unanswered", label: "Unanswered" },
  { id: "following", label: "Following" },
  { id: "mine", label: "Mine" },
];
