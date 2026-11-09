export type ChatChannel = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string | null;
  /** When true, only listed members (+ admins) can see and post. */
  is_private: boolean;
};

/** Latest message summary for the channel sidebar. */
export type ChatChannelPreview = {
  messageId: string;
  body: string;
  createdAt: string;
  authorName: string;
  userId: string;
};

export type ChatAuthor = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type ChatMessage = {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: ChatAuthor | null;
};

/** Lightweight person row for admin member pickers. */
export type ChatPersonOption = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
};
