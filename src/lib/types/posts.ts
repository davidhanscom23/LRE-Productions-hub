import type { Profile } from "@/lib/types/database";

export type PostAuthor = Pick<
  Profile,
  "id" | "full_name" | "email" | "avatar_url" | "color"
>;

export type PostKind = "user" | "birthday" | "anniversary";

export type PostComment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: PostAuthor | null;
};

export type Post = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: PostAuthor | null;
  kind?: PostKind;
  subject_profile_id?: string | null;
  celebration_date?: string | null;
  comments?: PostComment[];
};
