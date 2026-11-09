export type PollOption = {
  id: string;
  label: string;
  sort_order: number;
  votes: number;
};

export type Poll = {
  id: string;
  question: string;
  is_closed: boolean;
  closes_at: string | null;
  created_at: string;
  created_by: string;
  my_option_id: string | null;
  total_votes: number;
  options: PollOption[];
};
